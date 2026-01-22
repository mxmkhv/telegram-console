import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, useInput, useApp as useInkApp, useStdout } from "ink";
import { AppProvider, useApp } from "./state/context";
import { ChatList } from "./components/ChatList";
import { MessageView } from "./components/MessageView";
import { InputBar } from "./components/InputBar";
import { StatusBar } from "./components/StatusBar";
import { Setup } from "./components/Setup";
import { WelcomeSplash } from "./components/WelcomeSplash";
import { HeaderBar } from "./components/HeaderBar";
import { SettingsPanel } from "./components/SettingsPanel";
import { LogoutPrompt } from "./components/LogoutPrompt";
import { MediaPanel } from "./components/MediaPanel";
import { hasConfig, loadConfigWithEnvOverrides, saveConfig, deleteSession, deleteAllData, sessionExists, loadSession, saveSession } from "./config";
import { createTelegramService } from "./services/telegram";
import { createMockTelegramService } from "./services/telegram.mock";
import type { AppConfig, TelegramService, LogoutMode } from "./types";

interface MainAppProps {
  telegramService: TelegramService;
  onLogout: (mode: LogoutMode) => void;
}

function MainApp({ telegramService, onLogout }: MainAppProps) {
  const { state, dispatch } = useApp();
  const { exit } = useInkApp();
  const { stdout } = useStdout();
  const [chatIndex, setChatIndex] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

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

  // Initialize connection and load chats
  useEffect(() => {
    const init = async () => {
      await telegramService.connect();
      const chats = await telegramService.getChats();
      dispatch({ type: "SET_CHATS", payload: chats });
    };
    init();

    const unsubConnection = telegramService.onConnectionStateChange((connectionState) => {
      dispatch({ type: "SET_CONNECTION_STATE", payload: connectionState });
    });

    const unsubMessages = telegramService.onNewMessage((message, chatId) => {
      dispatch({ type: "ADD_MESSAGE", payload: { chatId, message } });
    });

    return () => {
      unsubConnection();
      unsubMessages();
    };
  }, [telegramService, dispatch]);

  // Load messages when chat is selected and mark as read
  useEffect(() => {
    if (state.selectedChatId) {
      const chatId = state.selectedChatId;
      telegramService.getMessages(chatId).then((messages) => {
        dispatch({
          type: "SET_MESSAGES",
          payload: { chatId, messages },
        });
        // Mark messages as read and clear unread count
        if (messages.length > 0) {
          const lastMessageId = messages[messages.length - 1]!.id;
          telegramService.markAsRead(chatId, lastMessageId).then((success) => {
            if (success) {
              dispatch({ type: "UPDATE_UNREAD_COUNT", payload: { chatId, count: 0 } });
            }
          });
        }
      });
    }
  }, [state.selectedChatId, telegramService, dispatch]);

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

  const handleSendMessage = useCallback(
    async (text: string, chatId: string) => {
      const message = await telegramService.sendMessage(chatId, text);
      dispatch({
        type: "ADD_MESSAGE",
        payload: { chatId, message },
      });
    },
    [telegramService, dispatch]
  );

  // Panel navigation and global keys (disabled when input is focused to not interfere with TextInput)
  useInput(
    (input, key) => {
      // Ctrl+C always exits
      if (key.ctrl && input === "c") {
        exit();
        return;
      }

      // Tab cycles panels
      if (key.tab) {
        if (state.focusedPanel === "header") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
        } else if (state.focusedPanel === "chatList") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "messages" });
        } else if (state.focusedPanel === "messages") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "input" });
        } else if (state.focusedPanel === "input") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "header" });
        }
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
        if (state.currentView === "settings") {
          dispatch({ type: "SET_CURRENT_VIEW", payload: "chat" });
        } else if (state.focusedPanel === "messages") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
        } else if (state.focusedPanel === "chatList") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "header" });
        }
        // mediaPanel escape is handled in MediaPanel component
        return;
      }

      // Global shortcuts (when not in input)
      if (input === "s" || input === "S") {
        dispatch({ type: "SET_CURRENT_VIEW", payload: "settings" });
        return;
      }
      if (input === "l" || input === "L") {
        dispatch({ type: "SET_SHOW_LOGOUT_PROMPT", payload: true });
        return;
      }

      // Panel-specific navigation
      if (state.focusedPanel === "chatList") {
        if (key.upArrow) {
          setChatIndex((i) => Math.max(0, i - 1));
        } else if (key.downArrow) {
          setChatIndex((i) => Math.min(state.chats.length - 1, i + 1));
        } else if (key.return) {
          const chat = state.chats[chatIndex];
          if (chat) handleSelectChat(chat.id);
        } else if (key.rightArrow) {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "messages" });
        }
      } else if (state.focusedPanel === "messages") {
        if (key.upArrow) {
          setMessageIndex((i) => Math.max(0, i - 1));
        } else if (key.downArrow) {
          setMessageIndex((i) => Math.min(currentMessages.length - 1, i + 1));
        } else if (key.leftArrow) {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
        } else if (key.return) {
          // If at top and can load older, load them; otherwise go to input
          if (canLoadOlder) {
            loadOlderMessages();
          } else {
            dispatch({ type: "SET_FOCUSED_PANEL", payload: "input" });
          }
        }
      }
    },
    { isActive: state.focusedPanel !== "input" }
  );

  // Escape to exit input mode (only active when input is focused)
  useInput(
    (_input, key) => {
      if (key.escape) {
        dispatch({ type: "SET_FOCUSED_PANEL", payload: "messages" });
      }
    },
    { isActive: state.focusedPanel === "input" }
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

  // Reset message index to last message when chat changes, messages first load, or new message added
  const prevChatIdRef = React.useRef<string | null>(null);
  const prevMessageCountRef = React.useRef<number>(0);
  useEffect(() => {
    const chatChanged = state.selectedChatId !== prevChatIdRef.current;
    const messagesFirstLoaded = prevMessageCountRef.current === 0 && currentMessages.length > 0;
    // New message added (count increased by 1, not a prepend of many)
    const newMessageAdded = currentMessages.length === prevMessageCountRef.current + 1;

    if (chatChanged || messagesFirstLoaded || newMessageAdded) {
      prevChatIdRef.current = state.selectedChatId;
      if (currentMessages.length > 0) {
        setMessageIndex(currentMessages.length - 1);
      } else {
        setMessageIndex(0);
      }
    }
    prevMessageCountRef.current = currentMessages.length;
  }, [state.selectedChatId, currentMessages.length]);

  // Check if we can load older messages (near top of messages)
  const canLoadOlder = useMemo(() => {
    const chatId = state.selectedChatId;
    if (!chatId || currentMessages.length === 0) return false;
    return (
      messageIndex === 0 &&
      state.hasMoreMessages[chatId] !== false &&
      !state.loadingOlderMessages[chatId]
    );
  }, [messageIndex, state.selectedChatId, currentMessages.length, state.hasMoreMessages, state.loadingOlderMessages]);

  // Function to load older messages (called manually)
  const loadOlderMessages = useCallback(() => {
    const chatId = state.selectedChatId;
    if (!chatId || !canLoadOlder) return;

    const oldestMessage = currentMessages[0];
    if (!oldestMessage) return;

    dispatch({ type: "SET_LOADING_OLDER_MESSAGES", payload: { chatId, loading: true } });

    telegramService.getMessages(chatId, 50, oldestMessage.id).then((olderMessages) => {
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
    });
  }, [state.selectedChatId, canLoadOlder, currentMessages, telegramService, dispatch]);

  // Memoize focus booleans to prevent unnecessary child re-renders
  const isHeaderFocused = state.focusedPanel === "header";
  const isChatListFocused = state.focusedPanel === "chatList";
  const isMessagesFocused = state.focusedPanel === "messages";
  const isInputFocused = state.focusedPanel === "input";
  const isMediaPanelFocused = state.focusedPanel === "mediaPanel";
  const isLoadingOlder = state.selectedChatId ? state.loadingOlderMessages[state.selectedChatId] ?? false : false;

  // Calculate terminal dimensions and panel sizes
  const terminalWidth = stdout?.columns ?? 80;
  const chatListWidth = 35;
  const mediaPanelWidth = Math.floor(terminalWidth * 0.4);
  // MessageView width: fills remaining space, shrinks when media panel is open
  const messageViewWidth = state.mediaPanel.isOpen
    ? terminalWidth - chatListWidth - mediaPanelWidth
    : terminalWidth - chatListWidth;
  // Panel height: visible rows (20) + header/border chrome (3) to match ChatList and MessageView
  const visibleRows = 20;
  const panelChrome = 3;
  const panelHeight = visibleRows + panelChrome;

  // Find the message for the media panel
  const mediaPanelMessage = useMemo(() => {
    if (!state.mediaPanel.isOpen || state.mediaPanel.messageId === null) {
      return null;
    }
    return currentMessages.find((m) => m.id === state.mediaPanel.messageId) ?? null;
  }, [state.mediaPanel.isOpen, state.mediaPanel.messageId, currentMessages]);

  return (
    <Box flexDirection="column" height="100%">
      <HeaderBar
        isFocused={isHeaderFocused}
        selectedButton={state.headerSelectedButton}
      />
      {state.showLogoutPrompt ? (
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <LogoutPrompt onConfirm={handleLogoutConfirm} onCancel={handleLogoutCancel} />
        </Box>
      ) : state.currentView === "settings" ? (
        <SettingsPanel />
      ) : (
        <>
          <Box flexGrow={1}>
            <ChatList
              chats={state.chats}
              selectedChatId={state.selectedChatId}
              onSelectChat={handleSelectChat}
              selectedIndex={chatIndex}
              isFocused={isChatListFocused}
            />
            <MessageView
              isFocused={isMessagesFocused && !state.mediaPanel.isOpen}
              selectedChatTitle={selectedChat?.title ?? null}
              messages={currentMessages}
              selectedIndex={messageIndex}
              isLoadingOlder={isLoadingOlder}
              canLoadOlder={canLoadOlder}
              width={messageViewWidth}
              dispatch={dispatch}
              messageLayout={state.messageLayout}
              isGroupChat={selectedChat?.isGroup ?? false}
            />
            {state.mediaPanel.isOpen && mediaPanelMessage && (
              <MediaPanel
                message={mediaPanelMessage}
                panelWidth={mediaPanelWidth}
                panelHeight={panelHeight}
                downloadMedia={telegramService.downloadMedia.bind(telegramService)}
                onClose={handleCloseMediaPanel}
                isFocused={isMediaPanelFocused}
              />
            )}
          </Box>
          <InputBar
            isFocused={isInputFocused}
            onSubmit={handleSendMessage}
            selectedChatId={state.selectedChatId}
          />
        </>
      )}
      <StatusBar
        connectionState={state.connectionState}
        focusedPanel={state.focusedPanel}
      />
    </Box>
  );
}

interface AppProps {
  useMock?: boolean;
}

export function App({ useMock = false }: AppProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [telegramService, setTelegramService] = useState<TelegramService | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [_isReturningUser, setIsReturningUser] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (hasConfig()) {
      const loadedConfig = loadConfigWithEnvOverrides();
      if (loadedConfig && loadedConfig.apiId && loadedConfig.apiHash) {
        setConfig(loadedConfig);
        // Check if session exists (returning user)
        setIsReturningUser(sessionExists());
        setIsSetupComplete(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isSetupComplete && config) {
      if (useMock) {
        setTelegramService(createMockTelegramService());
      } else {
        // Try to load existing session
        const session = loadSession();

        setTelegramService(
          createTelegramService({
            apiId: config.apiId,
            apiHash: config.apiHash,
            session,
            onSessionUpdate: (newSession) => {
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
  }, [isSetupComplete, config, useMock]);

  // Fetch user name and show welcome after service is ready
  useEffect(() => {
    if (telegramService && !showWelcome && userName === "") {
      telegramService.connect().then(async () => {
        try {
          // Get user info - we need to access the underlying client
          // For now, use a placeholder; this will be enhanced
          setUserName("User");
          setShowWelcome(true);
        } catch {
          setShowWelcome(true);
        }
      });
    }
  }, [telegramService, showWelcome, userName]);

  const handleSetupComplete = useCallback((newConfig: AppConfig, session: string) => {
    saveConfig(newConfig);
    // Save session string to config directory
    if (session) {
      saveSession(session);
    }
    setConfig(newConfig);
    setIsSetupComplete(true);
  }, []);

  const handleWelcomeDismiss = useCallback(() => {
    setShowWelcome(false);
  }, []);

  const handleLogout = useCallback((mode: LogoutMode) => {
    if (telegramService) {
      telegramService.disconnect();
    }
    if (mode === "session") {
      deleteSession();
      // Return to QR auth - keep config, clear setup state
      setTelegramService(null);
      setShowWelcome(false);
      setUserName("");
      setIsReturningUser(false);
      // Re-trigger setup but skip to auth step
      setIsSetupComplete(false);
    } else {
      deleteAllData();
      // Full reset - clear everything
      setConfig(null);
      setTelegramService(null);
      setShowWelcome(false);
      setUserName("");
      setIsReturningUser(false);
      setIsSetupComplete(false);
    }
  }, [telegramService]);

  if (!isSetupComplete) {
    return (
      <Setup
        onComplete={handleSetupComplete}
        preferredAuthMethod="qr"
      />
    );
  }

  if (!telegramService) {
    return null;
  }

  if (showWelcome) {
    return <WelcomeSplash onContinue={handleWelcomeDismiss} />;
  }

  return (
    <AppProvider telegramService={telegramService}>
      <MainApp telegramService={telegramService} onLogout={handleLogout} />
    </AppProvider>
  );
}
