import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { unlink } from "node:fs/promises";
import { useInput, useApp as useInkApp } from "ink";
import { Box, Text } from "./components/ui";
import { ColorModeContext } from "./components/ui/ColorModeContext";
import { SkinContext } from "./components/ui/SkinContext";
import { getSkin } from "./config/skins";
import { ShortcutsBar } from "./components/ShortcutsBar";
import { AppProvider, useApp } from "./state/context";
import { isOverlayOpen } from "./state/reducer";
import { ChatList } from "./components/ChatList";
import { ChatStrip } from "./components/ChatStrip";
import { MessageView } from "./components/MessageView";
import { isNarrowLayout, getChatListWidth, getMessageViewWidth } from "./layout";
import { InputBar } from "./components/InputBar";
import { StatusBar } from "./components/StatusBar";
import { Setup } from "./components/Setup";
import { HeaderBar } from "./components/HeaderBar";
import { SettingsPanel } from "./components/SettingsPanel";
import { LogoutPrompt } from "./components/LogoutPrompt";
import { ChatSwitcher } from "./components/ChatSwitcher";
import { HelpOverlay } from "./components/HelpOverlay";
import { MediaPanel } from "./components/MediaPanel";
import { BlankScreen } from "./components/BlankScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NoticeLine } from "./components/NoticeLine";
import { describeError } from "./utils/describeError";
import { withTimeout } from "./utils/withTimeout";

const DELIVERY_TIMEOUT_MS = 30_000;
// A stalled load turns into the error state, which Ctrl+R can retry
const LOAD_TIMEOUT_MS = 30_000;
const DELIVERY_TIMEOUT_REASON = "no response from Telegram";
import { hasConfig, loadConfig, loadConfigWithEnvOverrides, saveConfig, deleteSession, deleteAllData, loadSession, saveSession } from "./config";
import { useTerminalSize } from "./hooks/useTerminalSize";
import { useTerminalNotifications } from "./hooks/useTerminalNotifications";
import { createTelegramService } from "./services/telegram";
import { createMockTelegramService, mockFailuresFromEnv } from "./services/telegram.mock";
import { getClipboardImage } from "./services/clipboard";
import type { AppConfig, TelegramService, LogoutMode, ImageSendResult, ChatDraft, FocusedPanel, LoadStatus, Message } from "./types";

interface MainAppProps {
  telegramService: TelegramService;
  onLogout: (mode: LogoutMode) => void;
  onToggleNoColor: () => void;
  /** Writes the bell, window title and notification escapes; tests leave it out */
  writeToTerminal?: (data: string) => void;
}

// Escapes go straight to the terminal: they print nothing, so Ink's frame is unaffected
const terminalWriter = process.stdout.isTTY ? (data: string) => void process.stdout.write(data) : undefined;

export function MainApp({ telegramService, onLogout, onToggleNoColor, writeToTerminal }: MainAppProps) {
  const { state, dispatch } = useApp();

  useTerminalNotifications({
    write: writeToTerminal,
    telegramService,
    chats: state.chats,
    viewingChatId: state.currentView === "chat" ? state.selectedChatId : null,
    hidden: state.isHidden,
    mode: state.notifications,
  });
  const { exit } = useInkApp();
  // Track highlighted chat by ID (not index) so it follows when chats reorder
  const [highlightedChatId, setHighlightedChatId] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  // Derive chatIndex from ID - automatically updates when chats reorder
  const chatIndex = useMemo(() => {
    if (!highlightedChatId || state.chats.length === 0) return 0;
    const index = state.chats.findIndex((c) => c.id === highlightedChatId);
    return index >= 0 ? index : 0;
  }, [highlightedChatId, state.chats]);

  const handleHeaderActivate = useCallback(
    (button: "settings" | "logout") => {
      if (button === "settings") {
        dispatch({ type: "SET_CURRENT_VIEW", payload: "settings" });
      } else {
        dispatch({ type: "SET_SHOW_LOGOUT_PROMPT", payload: true });
      }
    },
    [dispatch]
  );

  const handleLogoutConfirm = useCallback(
    (mode: LogoutMode) => {
      dispatch({ type: "SET_SHOW_LOGOUT_PROMPT", payload: false });
      onLogout(mode);
    },
    [dispatch, onLogout]
  );

  const handleLogoutCancel = useCallback(() => {
    dispatch({ type: "SET_SHOW_LOGOUT_PROMPT", payload: false });
  }, [dispatch]);

  const handleCloseMediaPanel = useCallback(() => {
    dispatch({ type: "CLOSE_MEDIA_PANEL" });
    dispatch({ type: "SET_FOCUSED_PANEL", payload: "messages" });
  }, [dispatch]);

  // Memoize service method bindings to prevent new refs on every render
  const sendReaction = useCallback(
    (chatId: string, messageId: number, emoji: string) =>
      telegramService.sendReaction(chatId, messageId, emoji),
    [telegramService]
  );

  const removeReaction = useCallback(
    (chatId: string, messageId: number) =>
      telegramService.removeReaction(chatId, messageId),
    [telegramService]
  );

  const downloadMedia = useCallback(
    (message: Parameters<typeof telegramService.downloadMedia>[0]) =>
      telegramService.downloadMedia(message),
    [telegramService]
  );

  // Latest state for async callbacks that resolve after later renders
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Messages sent from here get a negative local id until Telegram assigns one
  const nextLocalId = useRef(-1);

  const showError = useCallback(
    (text: string, sticky?: boolean) => {
      dispatch({ type: "SHOW_NOTICE", payload: { kind: "error", text, sticky } });
    },
    [dispatch]
  );

  const handleNoticeExpire = useCallback(
    (id: number) => dispatch({ type: "CLEAR_NOTICE", payload: { id } }),
    [dispatch]
  );

  // Initialize connection and load chats. Bumping connectAttempt retries.
  const [connectAttempt, setConnectAttempt] = useState(0);
  const [initFailed, setInitFailed] = useState(false);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      let step = "connect to Telegram";
      try {
        await telegramService.connect();
        step = "load your chats";
        const chats = await telegramService.getChats();
        if (cancelled) return;
        dispatch({ type: "SET_CHATS", payload: chats });
        setChatsLoaded(true);
      } catch (err) {
        if (cancelled) return;
        setInitFailed(true);
        showError(`Couldn't ${step}: press Ctrl+R to retry (${describeError(err)})`, true);
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [telegramService, connectAttempt, dispatch, showError]);

  const retryInit = useCallback(() => {
    setInitFailed(false);
    dispatch({ type: "CLEAR_NOTICE" });
    setConnectAttempt((n) => n + 1);
  }, [dispatch]);

  useEffect(() => {
    const unsubConnection = telegramService.onConnectionStateChange((connectionState) => {
      dispatch({ type: "SET_CONNECTION_STATE", payload: connectionState });
    });

    const unsubMessages = telegramService.onNewMessage((message, chatId) => {
      dispatch({ type: "ADD_MESSAGE", payload: { chatId, message } });
    });

    const unsubTyping = telegramService.onTyping((chatId, isTyping) => {
      dispatch({ type: "SET_TYPING", payload: { chatId, isTyping } });
    });

    return () => {
      unsubConnection();
      unsubMessages();
      unsubTyping();
    };
  }, [telegramService, dispatch]);

  // Load messages when chat is selected and mark as read. Bumping loadAttempt retries.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadFailedChatId, setLoadFailedChatId] = useState<string | null>(null);
  useEffect(() => {
    if (!state.selectedChatId) return;

    const chatId = state.selectedChatId;
    let cancelled = false;
    setLoadFailedChatId(null);
    const loadMessages = async () => {
      let messages: Message[];
      try {
        messages = await withTimeout(telegramService.getMessages(chatId), LOAD_TIMEOUT_MS, "no response from Telegram");
      } catch (err) {
        if (cancelled) return;
        const title = stateRef.current.chats.find((c) => c.id === chatId)?.title ?? "this chat";
        setLoadFailedChatId(chatId);
        showError(`Couldn't load ${title}: press Ctrl+R to retry (${describeError(err)})`);
        return;
      }
      if (cancelled) return;
      dispatch({
        type: "SET_MESSAGES",
        payload: { chatId, messages },
      });

      // Mark as read in parallel (fire-and-forget, doesn't block UI)
      if (messages.length > 0) {
        const lastMessageId = messages.at(-1)!.id;
        telegramService.markAsRead(chatId, lastMessageId).then((success) => {
          if (success) {
            dispatch({ type: "UPDATE_UNREAD_COUNT", payload: { chatId, count: 0 } });
          }
        });
      }
    };

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [state.selectedChatId, loadAttempt, telegramService, dispatch, showError]);

  const messagesStatus: LoadStatus = !state.selectedChatId
    ? "ready"
    : loadFailedChatId === state.selectedChatId
      ? "error"
      : state.messages[state.selectedChatId] === undefined
        ? "loading"
        : "ready";
  const chatsStatus: LoadStatus = initFailed ? "error" : chatsLoaded ? "ready" : "loading";

  // Ctrl+R retries whatever failed to load
  const canRetry = initFailed || messagesStatus === "error";
  const retry = useCallback(() => {
    if (initFailed) {
      retryInit();
      return;
    }
    dispatch({ type: "CLEAR_NOTICE" });
    setLoadAttempt((n) => n + 1);
  }, [initFailed, retryInit, dispatch]);

  // Messages sent while the connection was down never arrive as updates, so
  // reload the chat list and the open chat once it's back
  const connectionDropped = useRef(false);
  useEffect(() => {
    if (!chatsLoaded) return;
    if (state.connectionState !== "connected") {
      connectionDropped.current = true;
      return;
    }
    if (!connectionDropped.current) return;
    connectionDropped.current = false;
    telegramService.getChats().then(
      (chats) => dispatch({ type: "SET_CHATS", payload: chats }),
      (err: unknown) => showError(`Reconnected, but couldn't refresh your chats; new messages still arrive (${describeError(err)})`),
    );
    if (stateRef.current.selectedChatId) setLoadAttempt((n) => n + 1);
  }, [state.connectionState, chatsLoaded, telegramService, dispatch, showError]);

  // Focus media panel when it opens
  useEffect(() => {
    if (state.mediaPanel.isOpen) {
      dispatch({ type: "SET_FOCUSED_PANEL", payload: "mediaPanel" });
    }
  }, [state.mediaPanel.isOpen, dispatch]);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      dispatch({ type: "SELECT_CHAT", payload: chatId });
      dispatch({ type: "SET_FOCUSED_PANEL", payload: "input" });
    },
    [dispatch]
  );

  const openChatSwitcher = useCallback(() => {
    dispatch({ type: "SET_SHOW_CHAT_SWITCHER", payload: true });
  }, [dispatch]);

  const closeChatSwitcher = useCallback(() => {
    dispatch({ type: "SET_SHOW_CHAT_SWITCHER", payload: false });
  }, [dispatch]);

  const closeHelp = useCallback(() => {
    dispatch({ type: "SET_SHOW_HELP", payload: false });
  }, [dispatch]);

  const handleSwitchToChat = useCallback(
    (chatId: string) => {
      dispatch({ type: "SET_SHOW_CHAT_SWITCHER", payload: false });
      setHighlightedChatId(chatId);
      handleSelectChat(chatId);
    },
    [dispatch, handleSelectChat]
  );

  // Sends the local message and swaps in Telegram's copy once it's accepted
  const deliverSend = useCallback(
    async (chatId: string, local: Message) => {
      try {
        const message = await withTimeout(
          telegramService.sendMessage(chatId, local.text, local.replyToMsgId, local.replyToSenderName),
          DELIVERY_TIMEOUT_MS,
          DELIVERY_TIMEOUT_REASON
        );
        dispatch({ type: "CONFIRM_MESSAGE", payload: { chatId, localId: local.id, message } });
      } catch (err) {
        dispatch({
          type: "SET_DELIVERY",
          payload: { chatId, messageId: local.id, text: local.text, delivery: { action: "send", status: "failed" } },
        });
        showError(`Message not sent: Esc, then Enter on it to retry or x to discard (${describeError(err)})`);
      }
    },
    [telegramService, dispatch, showError]
  );

  const deliverEdit = useCallback(
    async (chatId: string, messageId: number, text: string, originalText: string) => {
      try {
        await withTimeout(
          telegramService.editMessage(chatId, messageId, text),
          DELIVERY_TIMEOUT_MS,
          DELIVERY_TIMEOUT_REASON
        );
        dispatch({ type: "SET_DELIVERY", payload: { chatId, messageId, text, delivery: undefined } });
      } catch (err) {
        dispatch({
          type: "SET_DELIVERY",
          payload: { chatId, messageId, text, delivery: { action: "edit", status: "failed", originalText } },
        });
        showError(`Edit not saved: Esc, then Enter on it to retry or x to undo (${describeError(err)})`);
      }
    },
    [telegramService, dispatch, showError]
  );

  // Shows the message right away as pending; failure keeps it in the list
  // marked as not sent, so typed text is never lost.
  const handleSendMessage = useCallback(
    (text: string, chatId: string) => {
      // No reply clear here: InputBar cancels it on Enter
      const replyTo = state.replyingToMessage;
      const local: Message = {
        id: nextLocalId.current--,
        senderId: "me",
        senderName: "You",
        text,
        timestamp: new Date(),
        isOutgoing: true,
        replyToMsgId: replyTo?.id,
        replyToSenderName: replyTo?.senderName,
        delivery: { action: "send", status: "pending" },
      };
      dispatch({ type: "ADD_MESSAGE", payload: { chatId, message: local } });
      void deliverSend(chatId, local);
    },
    [dispatch, deliverSend, state.replyingToMessage]
  );

  const handleRetryDelivery = useCallback(
    (chatId: string, message: Message) => {
      const { delivery } = message;
      if (delivery?.status !== "failed") return;
      dispatch({ type: "CLEAR_NOTICE" });
      dispatch({
        type: "SET_DELIVERY",
        payload: { chatId, messageId: message.id, text: message.text, delivery: { ...delivery, status: "pending" } },
      });
      if (delivery.action === "send") {
        void deliverSend(chatId, message);
      } else {
        void deliverEdit(chatId, message.id, message.text, delivery.originalText);
      }
    },
    [dispatch, deliverSend, deliverEdit]
  );

  const handleSendImage = useCallback(
    async (chatId: string): Promise<ImageSendResult> => {
      const { path, error, isTemp } = await getClipboardImage();
      if (!path) {
        return { ok: false, error: error ?? "No image in clipboard" };
      }
      try {
        const message = await telegramService.sendImage(chatId, path);
        dispatch({ type: "ADD_MESSAGE", payload: { chatId, message } });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: `Image not sent (${describeError(err)})` };
      } finally {
        if (isTemp) {
          unlink(path).catch(() => {});
        }
      }
    },
    [telegramService, dispatch]
  );

  // Applies the edit right away; failure keeps the new text marked as not saved
  const handleEditMessage = useCallback(
    (text: string, chatId: string, messageId: number) => {
      const message = stateRef.current.messages[chatId]?.find((m) => m.id === messageId);
      if (!message) {
        showError("Edit not saved: the message is no longer loaded. Reopen the chat and try again");
        return;
      }
      // Re-editing an unsaved edit keeps the text Telegram actually has
      const originalText =
        message.delivery?.action === "edit" ? message.delivery.originalText : message.text;
      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          chatId,
          messageId,
          newText: text,
          delivery: { action: "edit", status: "pending", originalText },
        },
      });
      void deliverEdit(chatId, messageId, text, originalText);
    },
    [dispatch, deliverEdit, showError]
  );

  const handleCancelReply = useCallback(() => {
    dispatch({ type: "SET_REPLYING_TO", payload: null });
  }, [dispatch]);

  const handleCancelEdit = useCallback(() => {
    dispatch({ type: "SET_EDITING_MESSAGE", payload: null });
  }, [dispatch]);

  const handleSaveDraft = useCallback(
    (chatId: string, draft: ChatDraft) => {
      dispatch({ type: "SAVE_DRAFT", payload: { chatId, draft } });
    },
    [dispatch]
  );

  // Calculate terminal dimensions and panel sizes
  const { columns: terminalWidth, rows: terminalRows } = useTerminalSize();
  const narrow = isNarrowLayout(terminalWidth);
  const messageViewWidth = getMessageViewWidth(terminalWidth, narrow);

  // Dynamic height budget
  const isMinimal = state.uiMode === "minimal";
  const overlayOpen = isOverlayOpen(state);
  const modeIndicatorVisible = !!(state.replyingToMessage || state.editingMessage);
  // A long draft grows the input up to MAX_INPUT_ROWS, and the panels give way
  const [inputRows, setInputRows] = useState(1);
  const inputReserved = 2 + inputRows + (modeIndicatorVisible ? 1 : 0) + (state.notice ? 1 : 0);
  // panelDividers skins replace HeaderBar/StatusBar's round border (2 rows)
  // with a single 1-row rule, so each panel is 1 row shorter.
  const panelRows = getSkin(state.skin).panelDividers ? 2 : 3;
  const headerReserved = isMinimal ? 0 : panelRows;
  const statusReserved = isMinimal ? 0 : panelRows;
  const connReserved = isMinimal && state.connectionState !== "connected" ? 1 : 0;
  const stripReserved = narrow ? 1 : 0;
  const legendReserved = 1;
  const MIN_BODY_HEIGHT = 5;
  const bodyHeight = Math.max(
    MIN_BODY_HEIGHT,
    terminalRows - headerReserved - statusReserved - inputReserved - connReserved - stripReserved - legendReserved,
  );
  const panelHeight = bodyHeight;

  // Tab cycles panels, Shift+Tab cycles back
  const cycleFocus = (backwards: boolean) => {
    const order: FocusedPanel[] = isMinimal ? ["chatList", "messages", "input"] : ["header", "chatList", "messages", "input"];
    const current = order.indexOf(state.focusedPanel);
    if (current < 0) return;
    const next = order[(current + (backwards ? -1 : 1) + order.length) % order.length]!;
    dispatch({ type: "SET_FOCUSED_PANEL", payload: next });
  };

  // Panel navigation and global keys (disabled when input is focused to not interfere with TextInput)
  useInput(
    (input, key) => {
      // Ctrl+C always exits
      if (key.ctrl && input === "c") {
        exit();
        return;
      }

      if (key.ctrl && input === "r" && canRetry) {
        retry();
        return;
      }

      // Overlays (settings, logout, reactions, media, switcher) handle their own keys
      if (overlayOpen) {
        return;
      }

      if ((key.ctrl && input === "k") || input === "/") {
        openChatSwitcher();
        return;
      }

      if (input === "?") {
        dispatch({ type: "SET_SHOW_HELP", payload: true });
        return;
      }

      if (key.tab) {
        cycleFocus(key.shift);
        return;
      }

      // Toggle minimal/full UI mode (works from any panel)
      if (input === "m" || input === "M") {
        const next = state.uiMode === "full" ? "minimal" : "full";
        dispatch({ type: "SET_UI_MODE", payload: next });
        if (next === "minimal" && state.focusedPanel === "header") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
        }
        const cfg = loadConfig();
        if (cfg) {
          saveConfig({ ...cfg, uiMode: next });
        }
        return;
      }

      // Blank the screen (works from any panel except input)
      if (input === "h" || input === "H") {
        dispatch({ type: "SET_HIDDEN", payload: true });
        return;
      }

      // Toggle colors on/off (works from any panel except input)
      if (input === "c" || input === "C") {
        onToggleNoColor();
        return;
      }

      if (input === "s" || input === "S") {
        dispatch({ type: "SET_CURRENT_VIEW", payload: "settings" });
        return;
      }
      if (input === "l" || input === "L") {
        dispatch({ type: "SET_SHOW_LOGOUT_PROMPT", payload: true });
        return;
      }

      // Header panel navigation
      if (state.focusedPanel === "header") {
        if (key.escape) {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
        } else if (key.leftArrow) {
          dispatch({ type: "SET_HEADER_SELECTED_BUTTON", payload: "settings" });
        } else if (key.rightArrow) {
          dispatch({ type: "SET_HEADER_SELECTED_BUTTON", payload: "logout" });
        } else if (key.return) {
          handleHeaderActivate(state.headerSelectedButton);
        }
        return;
      }

      // Escape handling - context-aware focus chain
      if (key.escape) {
        if (state.focusedPanel === "messages") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
        } else if (state.focusedPanel === "chatList" && !isMinimal) {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "header" });
        }
        // mediaPanel escape is handled in MediaPanel component
        return;
      }

      // Panel-specific navigation
      if (state.focusedPanel === "chatList") {
        if (key.upArrow || input === "k" || (narrow && key.leftArrow)) {
          const newIndex = Math.max(0, chatIndex - 1);
          const newChat = state.chats[newIndex];
          if (newChat) setHighlightedChatId(newChat.id);
        } else if (key.downArrow || input === "j" || (narrow && key.rightArrow)) {
          const newIndex = Math.min(state.chats.length - 1, chatIndex + 1);
          const newChat = state.chats[newIndex];
          if (newChat) setHighlightedChatId(newChat.id);
        } else if (key.return) {
          const chat = state.chats[chatIndex];
          if (chat) handleSelectChat(chat.id);
        } else if (key.rightArrow && !narrow) {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "messages" });
        }
      } else if (state.focusedPanel === "messages") {
        if (key.leftArrow) {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
        }
        // Moving the selection and Enter belong to MessageView, which knows the page size
      }
    },
    { isActive: state.focusedPanel !== "input" && !state.isHidden }
  );

  // Leaving the input (only active when input is focused); the draft stays
  useInput(
    (input, key) => {
      if (overlayOpen) return;
      if (key.escape) {
        dispatch({ type: "SET_FOCUSED_PANEL", payload: "messages" });
      } else if (key.tab) {
        cycleFocus(key.shift);
      } else if (key.ctrl && input === "r" && canRetry) {
        retry();
      } else if (key.ctrl && input === "k") {
        openChatSwitcher();
      }
    },
    { isActive: state.focusedPanel === "input" && !state.isHidden }
  );

  // While hidden: swallow input; any key restores (Ctrl+C still exits)
  useInput(
    (input, key) => {
      if (key.ctrl && input === "c") {
        exit();
        return;
      }
      dispatch({ type: "SET_HIDDEN", payload: false });
    },
    { isActive: state.isHidden }
  );

  // Memoize derived data for child components
  const selectedChat = useMemo(
    () => state.chats.find((c) => c.id === state.selectedChatId),
    [state.chats, state.selectedChatId]
  );

  const currentMessages = useMemo(
    () => (state.selectedChatId ? state.messages[state.selectedChatId] ?? [] : []),
    [state.messages, state.selectedChatId]
  );

  const handleStartEdit = useCallback(() => {
    // Unsent messages have no server id to edit
    const lastOutgoing = currentMessages.findLast((m) => m.isOutgoing && m.delivery?.action !== "send");
    if (lastOutgoing) {
      dispatch({ type: "SET_EDITING_MESSAGE", payload: lastOutgoing });
    }
  }, [currentMessages, dispatch]);

  // Set while the selected message is taller than the panel and not read to
  // its end. State, not a ref: MessageView reports after each render, so for
  // an arrival this render still holds the position from before it, which a
  // new "↓ 1 more" row can't have changed yet.
  const [readingLongMessage, setReadingLongMessage] = useState(false);

  // Reset message index to last message when chat changes or messages load
  // Track message counts per-chat to handle switching between chats correctly
  const prevChatIdRef = React.useRef<string | null>(null);
  const messageCounts = React.useRef<Record<string, number>>({});
  useEffect(() => {
    const chatId = state.selectedChatId;
    const chatChanged = chatId !== prevChatIdRef.current;
    const prevCount = chatId ? messageCounts.current[chatId] ?? 0 : 0;
    const currentCount = currentMessages.length;
    const isLoadingOlder = chatId ? state.loadingOlderMessages[chatId] ?? false : false;

    // Scroll to bottom on: chat switch, messages loaded/replaced, or new message added
    // BUT NOT when loading older messages (PREPEND_MESSAGES adjusts index separately)
    // AND NOT when user has scrolled up (preserve their position)
    const messagesFirstLoaded = prevCount === 0 && currentCount > 0;
    const messagesBulkLoaded = !isLoadingOlder && currentCount > 0 && Math.abs(currentCount - prevCount) > 1;
    const newMessageAdded = currentCount === prevCount + 1;
    // Only auto-scroll to new message if user was already at the bottom, and
    // not while a reaction picker is open on the current message
    const wasAtBottom = prevCount === 0 || (messageIndex >= prevCount - 1 && !readingLongMessage);
    const shouldScrollToNew = newMessageAdded && wasAtBottom && !state.reactionOverlay;

    if (chatChanged || messagesFirstLoaded || messagesBulkLoaded || shouldScrollToNew) {
      prevChatIdRef.current = chatId;
      if (currentCount > 0) {
        setMessageIndex(currentCount - 1);
      } else {
        setMessageIndex(0);
      }
    } else if (messageIndex >= currentCount && currentCount > 0) {
      // Clamp index if out of bounds
      setMessageIndex(currentCount - 1);
    }

    if (chatId) {
      messageCounts.current[chatId] = currentCount;
    }
    // Re-running when readingLongMessage changes is a no-op: the counts already match
  }, [state.selectedChatId, currentMessages.length, messageIndex, state.loadingOlderMessages, state.reactionOverlay, readingLongMessage]);

  // Check if we can load older messages (near top of messages)
  const canLoadOlder = useMemo(() => {
    const chatId = state.selectedChatId;
    const oldest = currentMessages[0];
    // Paging needs a server id; unsent messages only have a negative local one
    if (!chatId || !oldest || oldest.id < 0) return false;
    return (
      messageIndex === 0 &&
      state.hasMoreMessages[chatId] !== false &&
      !state.loadingOlderMessages[chatId]
    );
  }, [messageIndex, state.selectedChatId, currentMessages, state.hasMoreMessages, state.loadingOlderMessages]);

  // Function to load older messages (called manually)
  const loadOlderMessages = useCallback(() => {
    const chatId = state.selectedChatId;
    if (!chatId || !canLoadOlder) return;

    const oldestMessage = currentMessages[0];
    if (!oldestMessage) return;

    dispatch({ type: "SET_LOADING_OLDER_MESSAGES", payload: { chatId, loading: true } });

    telegramService.getMessages(chatId, 50, oldestMessage.id).then(
      (olderMessages) => {
        if (olderMessages.length > 0) {
          dispatch({ type: "PREPEND_MESSAGES", payload: { chatId, messages: olderMessages } });
          // Adjust messageIndex to maintain position
          setMessageIndex((prev) => prev + olderMessages.length);
        }
        dispatch({
          type: "SET_HAS_MORE_MESSAGES",
          payload: { chatId, hasMore: olderMessages.length === 50 },
        });
        dispatch({ type: "SET_LOADING_OLDER_MESSAGES", payload: { chatId, loading: false } });
      },
      (err: unknown) => {
        dispatch({ type: "SET_LOADING_OLDER_MESSAGES", payload: { chatId, loading: false } });
        showError(`Couldn't load older messages: press Enter to retry (${describeError(err)})`);
      }
    );
  }, [state.selectedChatId, canLoadOlder, currentMessages, telegramService, dispatch, showError]);

  // Memoize focus booleans to prevent unnecessary child re-renders
  const isHeaderFocused = state.focusedPanel === "header";
  const isChatListFocused = state.focusedPanel === "chatList";
  const isMessagesFocused = state.focusedPanel === "messages";
  const isInputFocused = state.focusedPanel === "input";
  const isLoadingOlder = state.selectedChatId ? state.loadingOlderMessages[state.selectedChatId] ?? false : false;

  // Find the message for the media panel
  const mediaPanelMessage = useMemo(() => {
    if (!state.mediaPanel.isOpen || state.mediaPanel.messageId === null) {
      return null;
    }
    return currentMessages.find((m) => m.id === state.mediaPanel.messageId) ?? null;
  }, [state.mediaPanel.isOpen, state.mediaPanel.messageId, currentMessages]);

  if (state.isHidden) {
    return <BlankScreen />;
  }

  // Media popup: full-screen takeover. Replaces the entire UI with the photo
  // until closed (Esc/Enter), so the crisp image is as large as possible.
  if (state.mediaPanel.isOpen && mediaPanelMessage) {
    return (
      <SkinContext.Provider value={state.skin}>
        <MediaPanel
          message={mediaPanelMessage}
          panelWidth={terminalWidth}
          panelHeight={terminalRows}
          downloadMedia={downloadMedia}
          onClose={handleCloseMediaPanel}
          isFocused
        />
      </SkinContext.Provider>
    );
  }

  return (
    <SkinContext.Provider value={state.skin}>
      <Box flexDirection="column" height="100%">
        {!isMinimal && (
          <HeaderBar
            isFocused={isHeaderFocused}
            selectedButton={state.headerSelectedButton}
          />
        )}
        {state.showLogoutPrompt ? (
          <Box flexGrow={1} alignItems="center" justifyContent="center">
            <LogoutPrompt onConfirm={handleLogoutConfirm} onCancel={handleLogoutCancel} />
          </Box>
        ) : state.showChatSwitcher ? (
          <Box flexGrow={1} alignItems="center" justifyContent="center">
            <ChatSwitcher
              chats={state.chats}
              onSelect={handleSwitchToChat}
              onClose={closeChatSwitcher}
              width={Math.min(60, terminalWidth - 2)}
              maxRows={Math.min(12, panelHeight - 6)}
            />
          </Box>
        ) : state.showHelp ? (
          <Box flexGrow={1} alignItems="center" justifyContent="center">
            <HelpOverlay
              onClose={closeHelp}
              width={Math.min(100, terminalWidth - 2)}
              height={terminalRows - headerReserved - statusReserved}
            />
          </Box>
        ) : state.currentView === "settings" ? (
          <SettingsPanel />
        ) : (
          <>
            {narrow && (
              <ChatStrip
                chats={state.chats}
                status={chatsStatus}
                selectedIndex={chatIndex}
                selectedChatId={state.selectedChatId}
                isFocused={isChatListFocused}
                typingChats={state.typingChats}
                drafts={state.drafts}
              />
            )}
            <Box flexGrow={1}>
              {!narrow && (
                <ChatList
                  chats={state.chats}
                  status={chatsStatus}
                  selectedChatId={state.selectedChatId}
                  onSelectChat={handleSelectChat}
                  selectedIndex={chatIndex}
                  isFocused={isChatListFocused}
                  height={panelHeight}
                  width={getChatListWidth(terminalWidth)}
                  typingChats={state.typingChats}
                  drafts={state.drafts}
                />
              )}
              <MessageView
                isFocused={isMessagesFocused && !state.mediaPanel.isOpen}
                selectedChatTitle={selectedChat?.title ?? null}
                messages={currentMessages}
                selectedIndex={messageIndex}
                setSelectedIndex={setMessageIndex}
                isLoadingOlder={isLoadingOlder}
                loadStatus={messagesStatus}
                canLoadOlder={canLoadOlder}
                width={messageViewWidth}
                height={panelHeight}
                dispatch={dispatch}
                messageLayout={state.messageLayout}
                isGroupChat={selectedChat?.isGroup ?? false}
                chatId={state.selectedChatId}
                senderColors={state.selectedChatId ? state.senderColors[state.selectedChatId] : undefined}
                sendReaction={sendReaction}
                removeReaction={removeReaction}
                onRetryDelivery={handleRetryDelivery}
                onLoadOlder={loadOlderMessages}
                reactionOverlay={state.reactionOverlay}
                isTyping={!!(state.selectedChatId && state.typingChats[state.selectedChatId])}
                onLinesBelowChange={setReadingLongMessage}
              />
            </Box>
            {isMinimal && state.connectionState !== "connected" && (
              <Box paddingX={1}>
                <Text color={state.connectionState === "connecting" ? "yellow" : "red"}>
                  ● {state.connectionState === "connecting" ? "Connecting…" : "Disconnected"}
                </Text>
              </Box>
            )}
            <NoticeLine notice={state.notice} onExpire={handleNoticeExpire} />
            {/* Keyed by chat: remounting saves the old chat's draft and restores the new one's */}
            <InputBar
              key={state.selectedChatId ?? "none"}
              initialText={state.selectedChatId ? state.drafts[state.selectedChatId]?.text : undefined}
              onSaveDraft={handleSaveDraft}
              isFocused={isInputFocused}
              onSubmit={handleSendMessage}
              onEdit={handleEditMessage}
              onSendImage={handleSendImage}
              onStartEdit={handleStartEdit}
              selectedChatId={state.selectedChatId}
              replyingToMessage={state.replyingToMessage}
              editingMessage={state.editingMessage}
              onCancelReply={handleCancelReply}
              onCancelEdit={handleCancelEdit}
              width={terminalWidth}
              rows={inputRows}
              onRowsChange={setInputRows}
            />
            <ShortcutsBar width={terminalWidth} isTyping={isInputFocused} />
          </>
        )}
        {!isMinimal && (
          <StatusBar
            connectionState={state.connectionState}
            focusedPanel={state.focusedPanel}
            width={terminalWidth}
          />
        )}
      </Box>
    </SkinContext.Provider>
  );
}

interface AppProps {
  useMock?: boolean;
  incognito?: boolean;
}

export function App({ useMock = false, incognito = false }: AppProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [telegramService, setTelegramService] = useState<TelegramService | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  useEffect(() => {
    if (hasConfig()) {
      const loadedConfig = loadConfigWithEnvOverrides();
      if (loadedConfig && loadedConfig.apiId && loadedConfig.apiHash) {
        setConfig(loadedConfig);
        setIsSetupComplete(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isSetupComplete && config) {
      if (useMock) {
        setTelegramService(createMockTelegramService({ failures: mockFailuresFromEnv() }));
      } else {
        // Try to load existing session
        const session = loadSession();

        setTelegramService(
          createTelegramService({
            apiId: config.apiId,
            apiHash: config.apiHash,
            session,
            onSessionUpdate: incognito ? undefined : (newSession) => {
              try {
                saveSession(newSession);
              } catch {
                // Ignore errors saving session
              }
            },
          })
        );
      }
    }
  }, [isSetupComplete, config, useMock, incognito]);

  const handleSetupComplete = useCallback((newConfig: AppConfig, session: string) => {
    saveConfig(newConfig);
    // Save session string to config directory (skip in incognito mode)
    if (session && !incognito) {
      saveSession(session);
    }
    setConfig(newConfig);
    setIsSetupComplete(true);
  }, [incognito]);

  const handleLogout = useCallback((mode: LogoutMode) => {
    if (telegramService) {
      telegramService.disconnect();
    }
    if (mode === "session") {
      deleteSession();
      // Return to QR auth - keep config, clear setup state
      setTelegramService(null);
      // Re-trigger setup but skip to auth step
      setIsSetupComplete(false);
    } else {
      deleteAllData();
      // Full reset - clear everything
      setConfig(null);
      setTelegramService(null);
      setIsSetupComplete(false);
    }
  }, [telegramService]);

  const [noColor, setNoColor] = useState(
    () => process.env.NO_COLOR != null && process.env.NO_COLOR !== "",
  );
  useEffect(() => {
    if (config) setNoColor(config.noColor ?? false);
  }, [config]);

  const handleToggleNoColor = useCallback(() => {
    setNoColor((prev) => {
      const next = !prev;
      const cfg = loadConfig();
      if (cfg) saveConfig({ ...cfg, noColor: next });
      return next;
    });
  }, []);

  let tree: React.ReactNode;
  if (!isSetupComplete) {
    tree = <Setup onComplete={handleSetupComplete} preferredAuthMethod="qr" />;
  } else if (!telegramService) {
    tree = null;
  } else {
    tree = (
      <ErrorBoundary>
        <AppProvider
          telegramService={telegramService}
          initialUiMode={config?.uiMode}
          initialSkin={config?.skin}
          initialNotifications={config?.notifications}
        >
          <MainApp
            telegramService={telegramService}
            onLogout={handleLogout}
            onToggleNoColor={handleToggleNoColor}
            writeToTerminal={terminalWriter}
          />
        </AppProvider>
      </ErrorBoundary>
    );
  }

  return <ColorModeContext.Provider value={noColor}>{tree}</ColorModeContext.Provider>;
}
