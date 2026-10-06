import { memo, useMemo, useState, useCallback, useEffect, type Dispatch } from "react";
import { useInput } from "ink";
import { Box, Text, useSkin } from "./ui";
import type { Message, MessageLayout } from "../types";
import { formatMediaMetadata } from "../services/imageRenderer.js";
import type { AppAction, ReactionOverlay } from "../state/reducer.js";
import { Logo, LOGO_COLS, LOGO_ROWS } from "./Logo";
import { ReactionPicker, QUICK_EMOJIS } from "./ReactionPicker";
import { ReactionModal } from "./ReactionModal";
import { useFlash } from "../hooks/useFlash.js";
import { useTelegramService } from "../state/context.js";
import { FLASH_CONFIG } from "../config/flashConfig.js";
import { getSenderColor, type SenderColors } from "../utils/senderColor.js";

interface MessageViewProps {
  isFocused: boolean;
  selectedChatTitle: string | null;
  messages: Message[];
  selectedIndex: number;
  isLoadingOlder?: boolean;
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function countWrappedLines(line: string, width: number): number {
  if (width <= 0 || line.length <= width) return 1;
  const words = line.split(" ");
  let rows = 1;
  let col = 0; // characters used on the current row
  for (const word of words) {
    if (word.length === 0) {
      // Empty token = a space char (leading space or a run of spaces); it occupies one column.
      if (col + 1 <= width) {
        col += 1;
      } else {
        rows++;
        col = 1;
      }
      continue;
    }
    if (word.length > width) {
      // Long word hard-wraps onto its own rows.
      if (col > 0) rows++;
      const wordRows = Math.ceil(word.length / width);
      rows += wordRows - 1;
      const rem = word.length % width;
      col = rem === 0 ? width : rem;
      continue;
    }
    const needed = col === 0 ? word.length : col + 1 + word.length;
    if (needed <= width) {
      col = needed;
    } else {
      rows++;
      col = word.length;
    }
  }
  return rows;
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

function getMessageLineCount(msg: Message, isSelected: boolean, availableWidth: number): number {
  const lines = msg.text.split("\n");
  if (availableWidth <= 0) return lines.length;
  // The first rendered line carries the "[HH:MM] Sender: " prefix (+ optional reply
  // prefix, media info) and any reactions suffix; continuation \n-lines are indented
  // 8 spaces. Include them so the count matches Ink's actual wrapping and the visible
  // window doesn't over-pack and clip the bottom message.
  const senderName = msg.isOutgoing ? "You" : msg.senderName;
  const replyPrefix = msg.replyToMsgId ? `↩${msg.replyToSenderName ?? "Unknown"}: ` : "";
  const mediaInfo = msg.media ? ` ${formatMediaMetadata(msg.media, msg.id)}` : "";
  const firstPrefix = `[${formatTime(msg.timestamp)}] ${replyPrefix}${senderName}:${mediaInfo} `;
  const reactions =
    formatReactions(msg.reactions) + formatDelivery(msg) + formatRetryHint(msg, isSelected);
  let total = 0;
  for (let i = 0; i < lines.length; i++) {
    const content = i === 0 ? firstPrefix + lines[i] + reactions : "        " + lines[i];
    total += countWrappedLines(content, availableWidth);
  }
  return total;
}

function getBubbleMessageLineCount(msg: Message, isGroupChat: boolean, availableWidth: number): number {
  const hasName = isGroupChat && !msg.isOutgoing;
  if (!msg.text) return (hasName ? 1 : 0) + 1;
  const lines = msg.text.split("\n");
  let textLines = 0;
  if (availableWidth <= 0) {
    textLines = lines.length;
  } else {
    for (const line of lines) {
      textLines += countWrappedLines(line, availableWidth);
    }
  }
  // name line (if group + not outgoing) + text lines (timestamp is inline on last line)
  return (hasName ? 1 : 0) + Math.max(1, textLines);
}

function MessageViewInner({
  isFocused,
  selectedChatTitle,
  messages: chatMessages,
  selectedIndex,
  isLoadingOlder = false,
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

  // Message keys: 'r' react, 'R' reply, 'x' discard unsent, Enter (sole owner)
  useInput(
    (input, key) => {
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
  const messageLineCounts = useMemo(() => {
    return chatMessages.map((msg, index) => {
      const isSelected = index === selectedIndex && isFocused;
      if (messageLayout === "bubble") {
        return getBubbleMessageLineCount(msg, isGroupChat, contentWidth);
      }
      return getMessageLineCount(msg, isSelected, contentWidth);
    });
  }, [chatMessages, selectedIndex, isFocused, messageLayout, isGroupChat, contentWidth]);

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

    // Check if all messages fit
    if (totalLines <= visibleLines) {
      return {
        startIndex: 0,
        endIndex: total,
        showScrollUp: false,
        showScrollDown: false,
      };
    }

    // Reserve 1 line for scroll indicators when needed
    const reserveTop = 1;
    const reserveBottom = 1;

    // Start with the selected message and expand to fill available lines
    // Work backwards from selectedIndex first (to show context above)
    let start = selectedIndex;
    let end = selectedIndex + 1;
    let linesUsed = messageLineCounts[selectedIndex]!;

    // Calculate available lines (reserve space for potential indicators)
    const availableLines = visibleLines;

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
  }, [chatMessages.length, selectedIndex, messageLineCounts, totalLines, visibleLines]);

  // Get visible messages
  const visibleMessages = chatMessages.slice(startIndex, endIndex);

  const colorForSender = (senderId: string) =>
    senderColors?.[senderId] ?? getSenderColor(senderId);

  // Render a single message in bubble layout
  const renderBubbleMessage = (
    msg: Message,
    isSelected: boolean,
    _actualIndex: number,
  ) => {
    const showName = isGroupChat && !msg.isOutgoing;
    const textLines = msg.text ? msg.text.split("\n") : [""];
    const mediaInfo = msg.media ? formatMediaMetadata(msg.media, msg.id) : "";
    const viewHint = isSelected && msg.media ? " [Enter]" : "";
    const timestamp = `[${formatTime(msg.timestamp)}]`;
    const delivery = formatDelivery(msg);
    const retryHint = formatRetryHint(msg, isSelected);
    const deliveryColor = msg.delivery?.status === "failed" ? "red" : undefined;
    const senderColor = colorForSender(msg.senderId);
    const isFlashing = flashState?.messageId === msg.id || isMsgFlashing(msg.id);
    const flashColor = isFlashing ? flashState?.color : undefined;

    // Calculate padding for right-aligned messages

    return (
      <Box key={msg.id} flexDirection="column">
        {/* Sender name (groups only, others only) - with unique color */}
        {showName && (
          <Text color={senderColor}>{msg.senderName || "Unknown"}</Text>
        )}

        {/* Reply prefix */}
        {msg.replyToMsgId && (
          <Text dimColor>↩ {msg.replyToSenderName ?? "Unknown"}</Text>
        )}

        {/* Message content with inline timestamp on last line */}
        {textLines.map((line, lineIndex) => {
          const isLastLine = lineIndex === textLines.length - 1;
          const isFirstLine = lineIndex === 0;

          // Build content for this line
          let lineContent = line;
          if (isFirstLine && mediaInfo) {
            lineContent =
              `${line} ${mediaInfo}${viewHint}`.trim() ||
              `${mediaInfo}${viewHint}`;
          }

          // Add timestamp to end of last line
          const suffix = isLastLine ? ` ${timestamp}${delivery}${retryHint}` : "";
          const fullContent = lineContent + suffix;

          if (msg.isOutgoing) {
            // Right-aligned, blue (user's messages)
            const padding = Math.max(0, contentWidth - fullContent.length);
            return (
              <Text
                key={lineIndex}
                inverse={isSelected}
                backgroundColor={flashColor}
              >
                {" ".repeat(padding)}
                <Text color={isSelected ? undefined : "blue"}>{lineContent}</Text>
                {isLastLine && <Text dimColor> {timestamp}</Text>}
                {isLastLine && <Text color={deliveryColor} dimColor={!deliveryColor}>{delivery}</Text>}
                {isLastLine && <Text color="yellow">{retryHint}</Text>}
                {isLastLine && <Text>{formatReactions(msg.reactions)}</Text>}
              </Text>
            );
          } else {
            // Left-aligned, normal text (not dim for better readability)
            return (
              <Text
                key={lineIndex}
                inverse={isSelected}
                backgroundColor={flashColor}
              >
                <Text>{lineContent}</Text>
                {isLastLine && <Text dimColor> {timestamp}</Text>}
                {isLastLine && <Text color={deliveryColor} dimColor={!deliveryColor}>{delivery}</Text>}
                {isLastLine && <Text color="yellow">{retryHint}</Text>}
                {isLastLine && <Text>{formatReactions(msg.reactions)}</Text>}
              </Text>
            );
          }
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
      <Box
        flexDirection="column"
        paddingX={1}
        height={visibleLines}
        overflowY="hidden"
      >
        {isLoadingOlder && <Text dimColor> Loading older messages...</Text>}
        {canLoadOlder && !isLoadingOlder && (
          <Text color="yellow"> ↑ Press Enter to load older messages</Text>
        )}
        {showScrollUp && !isLoadingOlder && !canLoadOlder && (
          <Text dimColor> ↑ {startIndex} earlier</Text>
        )}
        {messageLayout === "bubble"
          ? // Bubble layout rendering
            visibleMessages.map((msg, i) => {
              const actualIndex = startIndex + i;
              const isSelected = actualIndex === selectedIndex && isFocused;
              if (reactionPickerOpen && msg.id === reactionOverlay?.messageId) {
                return (
                  <ReactionPicker
                    key={msg.id}
                    emojis={QUICK_EMOJIS}
                    selectedIndex={reactionPickerIndex}
                    onSelect={handleSendReaction}
                    onOpenModal={() => setReactionOverlay({ kind: "modal", messageId: msg.id })}
                    onCancel={() => setReactionOverlay(null)}
                  />
                );
              }
              return renderBubbleMessage(msg, isSelected, actualIndex);
            })
          : // Classic layout rendering (existing code)
            visibleMessages.map((msg, i) => {
              const actualIndex = startIndex + i;
              const isSelected = actualIndex === selectedIndex && isFocused;
              const isFlashing = flashState?.messageId === msg.id || isMsgFlashing(msg.id);
              const flashColor = isFlashing ? flashState?.color : undefined;

              if (reactionPickerOpen && msg.id === reactionOverlay?.messageId) {
                return (
                  <ReactionPicker
                    key={msg.id}
                    emojis={QUICK_EMOJIS}
                    selectedIndex={reactionPickerIndex}
                    onSelect={handleSendReaction}
                    onOpenModal={() => setReactionOverlay({ kind: "modal", messageId: msg.id })}
                    onCancel={() => setReactionOverlay(null)}
                  />
                );
              }

              const senderName = msg.isOutgoing ? "You" : msg.senderName;
              const nbspSenderName = senderName.replace(/ /g, "\u00A0");
              const lines = msg.text.split("\n");
              const mediaInfo = msg.media
                ? ` ${formatMediaMetadata(msg.media, msg.id)}`
                : "";
              const viewHint =
                isSelected && msg.media ? " [Press enter to view]" : "";
              return (
                <Box key={msg.id} flexDirection="column" flexShrink={0}>
                  {lines.map((line, lineIndex) => (
                    <Box key={lineIndex}>
                      <Text wrap="wrap" backgroundColor={flashColor}>
                        {lineIndex === 0 ? (
                          <>
                            <Text inverse={isSelected} dimColor={!isSelected}>
                              [{formatTime(msg.timestamp)}]{"\u00A0"}
                            </Text>
                            {/* Reply prefix */}
                            {msg.replyToMsgId && (
                              <Text inverse={isSelected} dimColor>
                                ↩{msg.replyToSenderName ?? "Unknown"}:{"\u00A0"}
                              </Text>
                            )}
                            <Text
                              inverse={isSelected}
                              bold
                              color={
                                isSelected
                                  ? undefined // No color when selected (use inverse colors)
                                  : msg.isOutgoing
                                    ? "blue"
                                    : colorForSender(msg.senderId)
                              }
                            >
                              {nbspSenderName}:
                            </Text>
                            <Text inverse={isSelected} dimColor>
                              {mediaInfo}
                            </Text>
                            <Text inverse={isSelected}> {line}</Text>
                            <Text inverse={isSelected} color="yellow">
                              {viewHint}
                            </Text>
                            <Text inverse={isSelected}>
                              {formatReactions(msg.reactions)}
                            </Text>
                            <Text
                              inverse={isSelected}
                              color={msg.delivery?.status === "failed" ? "red" : undefined}
                              dimColor={msg.delivery?.status === "pending"}
                            >
                              {formatDelivery(msg)}
                            </Text>
                            <Text inverse={isSelected} color="yellow">
                              {formatRetryHint(msg, isSelected)}
                            </Text>
                          </>
                        ) : (
                          <Text inverse={isSelected} dimColor={!isSelected}>
                            {"        "}
                            {line}
                          </Text>
                        )}
                      </Text>
                    </Box>
                  ))}
                </Box>
              );
            })}
        {showScrollDown && (
          <Text dimColor inverse={isIndicatorFlashing("scroll-indicator")}>
            {" "}↓ {chatMessages.length - endIndex} more
          </Text>
        )}
      </Box>
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
