import { memo, useMemo, useState, useCallback, useEffect, type Dispatch } from "react";
import { useInput } from "ink";
import stringWidth from "string-width";
import wrapAnsi from "wrap-ansi";
import { Box, Text, useSkin } from "./ui";
import type { LoadStatus, Message, MessageLayout } from "../types";
import { formatMediaMetadata } from "../services/imageRenderer.js";
import type { AppAction, ReactionOverlay } from "../state/reducer.js";
import { Logo, LOGO_COLS, LOGO_ROWS } from "./Logo";
import { ReactionPicker, QUICK_EMOJIS } from "./ReactionPicker";
import { ReactionModal } from "./ReactionModal";
import { useFlash } from "../hooks/useFlash.js";
import { useTelegramService } from "../state/context.js";
import { FLASH_CONFIG } from "../config/flashConfig.js";
import { getSenderColor, type SenderColors } from "../utils/senderColor.js";
import { formatDayLabel, formatTime, isSameDay } from "../utils/formatDate.js";

interface MessageViewProps {
  isFocused: boolean;
  selectedChatTitle: string | null;
  messages: Message[];
  selectedIndex: number;
  isLoadingOlder?: boolean;
  loadStatus?: LoadStatus;
  canLoadOlder?: boolean;
  width: number;
  height?: number;
  dispatch: Dispatch<AppAction>;
  messageLayout: MessageLayout;
  isGroupChat: boolean;
  chatId: string | null;
  senderColors?: SenderColors;
  setSelectedIndex?: (index: number) => void;
  sendReaction: (
    chatId: string,
    messageId: number,
    emoji: string,
  ) => Promise<boolean>;
  removeReaction: (chatId: string, messageId: number) => Promise<boolean>;
  onRetryDelivery: (chatId: string, message: Message) => void;
  onLoadOlder: () => void;
  reactionOverlay: ReactionOverlay;
  isTyping?: boolean;
}

// Rows a line takes once Ink wraps it: Ink wraps with this same wrap-ansi call
export function countWrappedLines(line: string, width: number): number {
  if (width <= 0) return 1;
  return wrapAnsi(line, width, { trim: false, hard: true }).split("\n").length;
}

function formatReactions(reactions: Message["reactions"]): string {
  if (!reactions || reactions.length === 0) return "";
  return (
    " | " +
    "[ " +
    reactions.map((r) => `${r.emoji}${r.count > 1 ? r.count : ""}`).join(" ") +
    " ]"
  );
}

// "…" while a send/edit is in flight, "!" once it failed
function formatDelivery(msg: Message): string {
  if (!msg.delivery) return "";
  if (msg.delivery.status === "pending") return " …";
  return msg.delivery.action === "send" ? " ! not sent" : " ! edit not saved";
}

function formatRetryHint(msg: Message, isSelected: boolean): string {
  if (!isSelected || msg.delivery?.status !== "failed") return "";
  return msg.delivery.action === "send" ? " [Enter: retry · x: discard]" : " [Enter: retry · x: undo]";
}

// Unsent messages have no server id yet, so they can't be replied or reacted to
function isUnsent(msg: Message): boolean {
  return msg.delivery?.action === "send";
}

function hasUserReaction(reactions: Message["reactions"]): boolean {
  return reactions?.some((r) => r.hasUserReacted) ?? false;
}

const CONTINUATION_INDENT = "        ";

// A classic first line's pieces, in render order. They're styled separately,
// but Ink wraps them as one string, so counting joins them the same way.
function getClassicFirstLine(msg: Message, text: string, isSelected: boolean) {
  const senderName = msg.isOutgoing ? "You" : msg.senderName;
  return {
    time: `[${formatTime(msg.timestamp)}]\u00A0`,
    reply: msg.replyToMsgId ? `↩${msg.replyToSenderName ?? "Unknown"}:\u00A0` : "",
    name: `${senderName.replace(/ /g, "\u00A0")}:`,
    media: msg.media ? ` ${formatMediaMetadata(msg.media, msg.id)}` : "",
    text: ` ${text}`,
    viewHint: isSelected && msg.media ? " [Press enter to view]" : "",
    reactions: formatReactions(msg.reactions),
    delivery: formatDelivery(msg),
    retryHint: formatRetryHint(msg, isSelected),
  };
}

function getMessageLineCount(msg: Message, isSelected: boolean, availableWidth: number): number {
  const [first = "", ...rest] = msg.text.split("\n");
  const firstLine = Object.values(getClassicFirstLine(msg, first, isSelected)).join("");
  return rest.reduce(
    (rows, line) => rows + countWrappedLines(CONTINUATION_INDENT + line, availableWidth),
    countWrappedLines(firstLine, availableWidth),
  );
}

// Bubble text lines (media info on the first) and the last line's suffix pieces
function getBubbleContent(msg: Message, isSelected: boolean) {
  const mediaInfo = msg.media ? formatMediaMetadata(msg.media, msg.id) : "";
  const viewHint = isSelected && msg.media ? " [Enter]" : "";
  const lines = (msg.text ? msg.text.split("\n") : [""]).map((line, i) =>
    i === 0 && mediaInfo ? `${line} ${mediaInfo}${viewHint}`.trim() : line,
  );
  const suffix = {
    timestamp: ` [${formatTime(msg.timestamp)}]`,
    delivery: formatDelivery(msg),
    retryHint: formatRetryHint(msg, isSelected),
    reactions: formatReactions(msg.reactions),
  };
  const fullLines = lines.map((line, i) => (i === lines.length - 1 ? line + Object.values(suffix).join("") : line));
  return { lines, suffix, fullLines };
}

function getBubbleMessageLineCount(
  msg: Message,
  isSelected: boolean,
  isGroupChat: boolean,
  availableWidth: number,
): number {
  const nameRows = isGroupChat && !msg.isOutgoing ? 1 : 0;
  const replyRows = msg.replyToMsgId ? 1 : 0;
  const { fullLines } = getBubbleContent(msg, isSelected);
  return fullLines.reduce((rows, line) => rows + countWrappedLines(line, availableWidth), nameRows + replyRows);
}

function MessageViewInner({
  isFocused,
  selectedChatTitle,
  messages: chatMessages,
  selectedIndex,
  isLoadingOlder = false,
  loadStatus = "ready",
  canLoadOlder = false,
  width,
  height = 24,
  dispatch,
  messageLayout,
  isGroupChat,
  chatId,
  senderColors,
  setSelectedIndex,
  sendReaction,
  removeReaction,
  onRetryDelivery,
  onLoadOlder,
  reactionOverlay,
  isTyping,
}: MessageViewProps) {
  const skin = useSkin();
  // panelDividers skins drop the left/right/outer-top/bottom border, leaving
  // only the header row + its divider (no outer border rows to subtract).
  const visibleLines = Math.max(1, height - (skin.panelDividers ? 2 : 4));
  // Reaction picker state
  // Open state lives in the app reducer so global keys can stand down
  const reactionPickerOpen = reactionOverlay?.kind === "picker";
  const reactionModalOpen = reactionOverlay?.kind === "modal";
  const setReactionOverlay = useCallback(
    (overlay: ReactionOverlay) => dispatch({ type: "SET_REACTION_OVERLAY", payload: overlay }),
    [dispatch],
  );
  const [reactionPickerIndex, setReactionPickerIndex] = useState(0);
  const [flashState, setFlashState] = useState<{
    messageId: number;
    color: string;
  } | null>(null);

  // New message flash state
  const { startFlash: startMsgFlash, isFlashing: isMsgFlashing } = useFlash();
  const { startFlash: startIndicatorFlash, isFlashing: isIndicatorFlashing } = useFlash();
  const telegramService = useTelegramService();

  // Check if user is viewing the bottom of messages
  const isAtBottom = useMemo(() => {
    return selectedIndex >= chatMessages.length - 1;
  }, [selectedIndex, chatMessages.length]);

  // Subscribe to new messages for this chat
  useEffect(() => {
    const unsub = telegramService?.onNewMessage((message, incomingChatId) => {
      if (message.isOutgoing || incomingChatId !== chatId) return;

      if (isAtBottom) {
        startMsgFlash(message.id, FLASH_CONFIG.messageFlashCount);
      } else {
        // Flash the "↓ X more" indicator and increment unread count
        startIndicatorFlash("scroll-indicator", FLASH_CONFIG.indicatorFlashCount);
        if (chatId) {
          dispatch({ type: "INCREMENT_UNREAD", payload: { chatId } });
        }
      }
    });
    return unsub;
  }, [telegramService, chatId, isAtBottom, startMsgFlash, startIndicatorFlash, dispatch]);

  // Clear unread count when user scrolls to bottom
  useEffect(() => {
    if (isAtBottom && chatId) {
      dispatch({ type: "UPDATE_UNREAD_COUNT", payload: { chatId, count: 0 } });
    }
  }, [isAtBottom, chatId, dispatch]);

  // Message keys: moving the selection, 'r' react, 'R' reply, 'x' discard unsent, Enter (sole owner)
  useInput(
    (input, key) => {
      const moveTo = (index: number) => {
        if (chatMessages.length > 0) setSelectedIndex?.(Math.max(0, Math.min(chatMessages.length - 1, index)));
      };
      // A page keeps one message of overlap for context
      const pageSize = Math.max(1, endIndex - startIndex - 1);
      if (key.upArrow || input === "k") return moveTo(selectedIndex - 1);
      if (key.downArrow || input === "j") return moveTo(selectedIndex + 1);
      if (key.pageUp) return moveTo(selectedIndex - pageSize);
      if (key.pageDown) return moveTo(selectedIndex + pageSize);
      if (key.home || input === "g") return moveTo(0);
      if (key.end || input === "G") return moveTo(chatMessages.length - 1);

      // Shift+R for reply (uppercase R)
      if (input === "R") {
        const selectedMessage = chatMessages[selectedIndex];
        if (selectedMessage && !isUnsent(selectedMessage)) {
          dispatch({ type: "SET_REPLYING_TO", payload: selectedMessage });
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "input" });
        }
        return;
      }

      // 'r' key for reactions (lowercase only now)
      if (input === "r") {
        const selectedMessage = chatMessages[selectedIndex];
        if (selectedMessage && !isUnsent(selectedMessage)) {
          if (hasUserReaction(selectedMessage.reactions)) {
            handleRemoveReaction(selectedMessage.id);
          } else {
            setReactionOverlay({ kind: "picker", messageId: selectedMessage.id });
            setReactionPickerIndex(0);
          }
        }
        return;
      }

      // Discard a failed send, or undo a failed edit
      if (input === "x") {
        const selectedMessage = chatMessages[selectedIndex];
        if (selectedMessage?.delivery?.status === "failed" && chatId) {
          dispatch({ type: "DISCARD_UNSENT", payload: { chatId, messageId: selectedMessage.id } });
          dispatch({ type: "CLEAR_NOTICE" });
        }
        return;
      }

      // Enter: retry a failed message, load older at the top, jump to the
      // replied message, open media, or else move to the input
      if (key.return) {
        const selectedMessage = chatMessages[selectedIndex];

        if (selectedMessage?.delivery?.status === "failed" && chatId) {
          onRetryDelivery(chatId, selectedMessage);
          return;
        }

        if (canLoadOlder) {
          onLoadOlder();
          return;
        }

        // If this is a reply message, navigate to original
        if (selectedMessage?.replyToMsgId && setSelectedIndex) {
          const originalIndex = chatMessages.findIndex(
            (m) => m.id === selectedMessage.replyToMsgId
          );
          if (originalIndex >= 0) {
            setSelectedIndex(originalIndex);
            startMsgFlash(selectedMessage.replyToMsgId, FLASH_CONFIG.messageFlashCount);
            return;
          }
        }

        if (selectedMessage?.media) {
          dispatch({
            type: "OPEN_MEDIA_PANEL",
            payload: { messageId: selectedMessage.id },
          });
          return;
        }

        dispatch({ type: "SET_FOCUSED_PANEL", payload: "input" });
      }
    },
    { isActive: isFocused && !reactionPickerOpen && !reactionModalOpen },
  );

  // Picker navigation (left/right arrows)
  useInput(
    (_input, key) => {
      if (key.leftArrow) {
        setReactionPickerIndex((i) => Math.max(0, i - 1));
      } else if (key.rightArrow) {
        setReactionPickerIndex((i) => Math.min(QUICK_EMOJIS.length, i + 1));
      }
    },
    { isActive: reactionPickerOpen && !reactionModalOpen },
  );

  // Reaction handlers
  const handleSendReaction = useCallback(
    async (emoji: string) => {
      const messageId = reactionOverlay?.messageId;
      if (messageId === undefined || !chatId) return;

      setReactionOverlay(null);

      // Optimistic update
      dispatch({ type: "ADD_REACTION", payload: { chatId, messageId, emoji } });

      // Flash green
      setFlashState({ messageId, color: "green" });
      setTimeout(() => setFlashState(null), 200);

      // API call with retry
      let success = await sendReaction(chatId, messageId, emoji);
      if (!success) {
        success = await sendReaction(chatId, messageId, emoji);
      }

      if (!success) {
        // Revert and flash red twice
        dispatch({ type: "REMOVE_REACTION", payload: { chatId, messageId } });
        setFlashState({ messageId, color: "red" });
        setTimeout(() => {
          setFlashState(null);
          setTimeout(() => {
            setFlashState({ messageId, color: "red" });
            setTimeout(() => setFlashState(null), 200);
          }, 100);
        }, 200);
      }
    },
    [reactionOverlay, chatId, dispatch, sendReaction, setReactionOverlay],
  );

  const handleRemoveReaction = useCallback(
    async (messageId: number) => {
      if (!chatId) return;

      // Store current reaction for potential revert
      const msg = chatMessages.find((m) => m.id === messageId);
      const userReaction = msg?.reactions?.find((r) => r.hasUserReacted);

      // Optimistic update
      dispatch({ type: "REMOVE_REACTION", payload: { chatId, messageId } });

      // Flash yellow
      setFlashState({ messageId, color: "yellow" });
      setTimeout(() => setFlashState(null), 200);

      // API call with retry
      let success = await removeReaction(chatId, messageId);
      if (!success) {
        success = await removeReaction(chatId, messageId);
      }

      if (!success && userReaction) {
        // Revert and flash red twice
        dispatch({
          type: "ADD_REACTION",
          payload: { chatId, messageId, emoji: userReaction.emoji },
        });
        setFlashState({ messageId, color: "red" });
        setTimeout(() => {
          setFlashState(null);
          setTimeout(() => {
            setFlashState({ messageId, color: "red" });
            setTimeout(() => setFlashState(null), 200);
          }, 100);
        }, 200);
      }
    },
    [chatId, chatMessages, dispatch, removeReaction],
  );

  // Calculate line count for each message
  // panelDividers skins have no left/right border columns, only paddingX.
  const contentWidth = width - (skin.panelDividers ? 2 : 4);
  // A day label above the first message of each day
  const daySeparators = useMemo(() => {
    const now = new Date();
    return chatMessages.map((msg, index) => {
      const previous = chatMessages[index - 1];
      return previous && isSameDay(previous.timestamp, msg.timestamp) ? null : formatDayLabel(msg.timestamp, now);
    });
  }, [chatMessages]);

  const messageLineCounts = useMemo(() => {
    return chatMessages.map((msg, index) => {
      const isSelected = index === selectedIndex && isFocused;
      const separatorRows = daySeparators[index] ? 1 : 0;
      if (messageLayout === "bubble") {
        return separatorRows + getBubbleMessageLineCount(msg, isSelected, isGroupChat, contentWidth);
      }
      return separatorRows + getMessageLineCount(msg, isSelected, contentWidth);
    });
  }, [chatMessages, daySeparators, selectedIndex, isFocused, messageLayout, isGroupChat, contentWidth]);

  const totalLines = useMemo(() => {
    return messageLineCounts.reduce((sum, count) => sum + count, 0);
  }, [messageLineCounts]);

  // Calculate visible window based on LINES, not message count
  const { startIndex, endIndex, showScrollUp, showScrollDown } = useMemo(() => {
    const total = chatMessages.length;
    if (total === 0) {
      return {
        startIndex: 0,
        endIndex: 0,
        showScrollUp: false,
        showScrollDown: false,
      };
    }

    // "Load older" or "Loading older" takes the top row whenever it shows,
    // in place of the "↑ N earlier" line
    const olderLine = isLoadingOlder || canLoadOlder ? 1 : 0;

    // Check if all messages fit
    if (totalLines + olderLine <= visibleLines) {
      return {
        startIndex: 0,
        endIndex: total,
        showScrollUp: false,
        showScrollDown: false,
      };
    }

    // Reserve 1 line for scroll indicators when needed
    const reserveTop = olderLine ? 0 : 1;
    const reserveBottom = 1;

    // Start with the selected message and expand to fill available lines
    // Work backwards from selectedIndex first (to show context above)
    let start = selectedIndex;
    let end = selectedIndex + 1;
    let linesUsed = messageLineCounts[selectedIndex]!;

    // Calculate available lines (reserve space for potential indicators)
    const availableLines = visibleLines - olderLine;

    // Check if we're at the last message (no bottom indicator needed)
    const atLastMessage = selectedIndex === total - 1;

    // First pass: expand backwards
    while (start > 0) {
      const prevLines = messageLineCounts[start - 1]!;
      const wouldNeedTopIndicator = start - 1 > 0;
      const neededReserve = wouldNeedTopIndicator ? reserveTop : 0;
      // Only reserve bottom space if we're not at the last message
      const bottomReserve = atLastMessage ? 0 : reserveBottom;

      if (
        linesUsed + prevLines + neededReserve <=
        availableLines - bottomReserve
      ) {
        start--;
        linesUsed += prevLines;
      } else {
        break;
      }
    }

    // Second pass: expand forwards
    while (end < total) {
      const nextLines = messageLineCounts[end]!;
      const wouldNeedBottomIndicator = end + 1 < total;
      const neededReserve = wouldNeedBottomIndicator ? reserveBottom : 0;
      const topReserve = start > 0 ? reserveTop : 0;

      if (
        linesUsed + nextLines + neededReserve + topReserve <=
        availableLines
      ) {
        linesUsed += nextLines;
        end++;
      } else {
        break;
      }
    }

    return {
      startIndex: start,
      endIndex: end,
      showScrollUp: start > 0,
      showScrollDown: end < total,
    };
  }, [chatMessages.length, selectedIndex, messageLineCounts, totalLines, visibleLines, isLoadingOlder, canLoadOlder]);

  // Get visible messages
  const visibleMessages = chatMessages.slice(startIndex, endIndex);

  const colorForSender = (senderId: string) =>
    senderColors?.[senderId] ?? getSenderColor(senderId);

  // Reaction feedback has its own color; new and jumped-to messages use the default
  const getFlashColor = (messageId: number) => {
    if (flashState?.messageId === messageId) return flashState.color;
    return isMsgFlashing(messageId) ? FLASH_CONFIG.messageColor : undefined;
  };

  // Render a single message in classic layout
  const renderClassicMessage = (msg: Message, isSelected: boolean) => {
    const flashColor = getFlashColor(msg.id);
    const [first = "", ...rest] = msg.text.split("\n");
    const firstLine = getClassicFirstLine(msg, first, isSelected);
    return (
      <Box flexDirection="column">
        <Text wrap="wrap" backgroundColor={flashColor}>
          <Text inverse={isSelected} dimColor={!isSelected}>
            {firstLine.time}
          </Text>
          <Text inverse={isSelected} dimColor>
            {firstLine.reply}
          </Text>
          <Text
            inverse={isSelected}
            bold
            // No color when selected: inverse carries it
            color={isSelected ? undefined : msg.isOutgoing ? "blue" : colorForSender(msg.senderId)}
          >
            {firstLine.name}
          </Text>
          <Text inverse={isSelected} dimColor>
            {firstLine.media}
          </Text>
          <Text inverse={isSelected}>{firstLine.text}</Text>
          <Text inverse={isSelected} color="yellow">
            {firstLine.viewHint}
          </Text>
          <Text inverse={isSelected}>{firstLine.reactions}</Text>
          <Text
            inverse={isSelected}
            color={msg.delivery?.status === "failed" ? "red" : undefined}
            dimColor={msg.delivery?.status === "pending"}
          >
            {firstLine.delivery}
          </Text>
          <Text inverse={isSelected} color="yellow">
            {firstLine.retryHint}
          </Text>
        </Text>
        {rest.map((line, lineIndex) => (
          <Text key={lineIndex} wrap="wrap" backgroundColor={flashColor} inverse={isSelected} dimColor={!isSelected}>
            {CONTINUATION_INDENT}
            {line}
          </Text>
        ))}
      </Box>
    );
  };

  // Render a single message in bubble layout
  const renderBubbleMessage = (msg: Message, isSelected: boolean) => {
    const showName = isGroupChat && !msg.isOutgoing;
    const { lines, suffix, fullLines } = getBubbleContent(msg, isSelected);
    const deliveryColor = msg.delivery?.status === "failed" ? "red" : undefined;
    const flashColor = getFlashColor(msg.id);

    return (
      <Box flexDirection="column">
        {/* Sender name (groups only, others only) - with unique color */}
        {showName && (
          <Text color={colorForSender(msg.senderId)}>{msg.senderName || "Unknown"}</Text>
        )}

        {msg.replyToMsgId && (
          <Text dimColor>↩ {msg.replyToSenderName ?? "Unknown"}</Text>
        )}

        {/* Message content with inline timestamp on last line */}
        {lines.map((line, lineIndex) => {
          const isLastLine = lineIndex === lines.length - 1;
          // Right-align the user's own messages
          const padding = msg.isOutgoing ? Math.max(0, contentWidth - stringWidth(fullLines[lineIndex]!)) : 0;
          return (
            <Text key={lineIndex} inverse={isSelected} backgroundColor={flashColor}>
              {" ".repeat(padding)}
              <Text color={msg.isOutgoing && !isSelected ? "blue" : undefined}>{line}</Text>
              {isLastLine && (
                <>
                  <Text dimColor>{suffix.timestamp}</Text>
                  <Text color={deliveryColor} dimColor={!deliveryColor}>
                    {suffix.delivery}
                  </Text>
                  <Text color="yellow">{suffix.retryHint}</Text>
                  <Text>{suffix.reactions}</Text>
                </>
              )}
            </Text>
          );
        })}
      </Box>
    );
  };

  if (!selectedChatTitle) {
    // Room for the logo plus the border, gap and hint, with breathing space around it.
    const fitsLogo = (height === undefined || height >= LOGO_ROWS + 6) && width >= LOGO_COLS + 6;
    return (
      <Box
        flexDirection="column"
        {...(skin.panelDividers ? {} : { borderStyle: "round" as const, borderColor: isFocused ? "cyan" : "blue" })}
        width={width}
        height={height}
        justifyContent="center"
        alignItems="center"
      >
        {/* One wrapper so the group is centered as a unit: when centering lands on a
            half row, Ink rounds sibling boxes differently and overlaps them by a row. */}
        <Box flexDirection="column" alignItems="center" gap={1}>
          {fitsLogo && <Logo />}
          <Text dimColor>Select a chat to start</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      {...(skin.panelDividers ? {} : { borderStyle: "round" as const, borderColor: isFocused ? "cyan" : "blue" })}
      width={width}
      height={height}
    >
      <Box
        paddingX={1}
        borderStyle="single"
        borderBottom
        borderLeft={false}
        borderRight={false}
        borderTop={false}
      >
        <Text bold color={isFocused ? "cyan" : undefined}>
          {selectedChatTitle}
        </Text>
        {isTyping && <Text dimColor italic> typing…</Text>}
        {totalLines > visibleLines && (
          <Text dimColor>
            {" "}
            ({selectedIndex + 1}/{chatMessages.length})
          </Text>
        )}
      </Box>
      {chatMessages.length === 0 ? (
        <Box flexDirection="column" height={visibleLines} justifyContent="center" alignItems="center">
          {loadStatus === "loading" && <Text dimColor>Loading messages…</Text>}
          {loadStatus === "error" && (
            <>
              <Text color="red">Couldn't load messages</Text>
              <Text dimColor>Press Ctrl+R to retry</Text>
            </>
          )}
          {loadStatus === "ready" && (
            <>
              <Text dimColor>No messages yet</Text>
              <Text dimColor>Say hi below</Text>
            </>
          )}
        </Box>
      ) : (
      <Box
        flexDirection="column"
        // Conversations sit on the input, like every chat app
        justifyContent="flex-end"
        paddingX={1}
        height={visibleLines}
        overflowY="hidden"
      >
        {isLoadingOlder && (
          <Text dimColor wrap="truncate">
            {" "}Loading older messages...
          </Text>
        )}
        {canLoadOlder && !isLoadingOlder && (
          <Text color="yellow" wrap="truncate">
            {" "}↑ Press Enter to load older messages
          </Text>
        )}
        {showScrollUp && !isLoadingOlder && !canLoadOlder && (
          <Text dimColor wrap="truncate">
            {" "}↑ {startIndex} earlier
          </Text>
        )}
        {visibleMessages.map((msg, i) => {
          const actualIndex = startIndex + i;
          const isSelected = actualIndex === selectedIndex && isFocused;
          const daySeparator = daySeparators[actualIndex];
          return (
            <Box key={msg.id} flexDirection="column" flexShrink={0}>
              {daySeparator && (
                <Box justifyContent="center">
                  <Text dimColor wrap="truncate">
                    ── {daySeparator} ──
                  </Text>
                </Box>
              )}
              {reactionPickerOpen && msg.id === reactionOverlay?.messageId ? (
                <ReactionPicker
                  emojis={QUICK_EMOJIS}
                  selectedIndex={reactionPickerIndex}
                  onSelect={handleSendReaction}
                  onOpenModal={() => setReactionOverlay({ kind: "modal", messageId: msg.id })}
                  onCancel={() => setReactionOverlay(null)}
                />
              ) : messageLayout === "bubble" ? (
                renderBubbleMessage(msg, isSelected)
              ) : (
                renderClassicMessage(msg, isSelected)
              )}
            </Box>
          );
        })}
        {showScrollDown && (
          <Text dimColor wrap="truncate" inverse={isIndicatorFlashing("scroll-indicator")}>
            {" "}↓ {chatMessages.length - endIndex} more
          </Text>
        )}
      </Box>
      )}
      {reactionModalOpen && (
        <Box position="absolute" marginTop={5} marginLeft={10}>
          <ReactionModal
            onSelect={handleSendReaction}
            onCancel={() => setReactionOverlay(null)}
          />
        </Box>
      )}
    </Box>
  );
}

export const MessageView = memo(MessageViewInner);
