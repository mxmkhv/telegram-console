import { memo, useMemo, type Dispatch } from "react";
import { Box, Text, useInput } from "ink";
import type { Message, MessageLayout } from "../types";
import { formatMediaMetadata } from '../services/imageRenderer.js';
import type { AppAction } from '../state/reducer.js';

const VISIBLE_LINES = 20;

interface MessageViewProps {
  isFocused: boolean;
  selectedChatTitle: string | null;
  messages: Message[];
  selectedIndex: number;
  isLoadingOlder?: boolean;
  canLoadOlder?: boolean;
  width: number;
  dispatch: Dispatch<AppAction>;
  messageLayout: MessageLayout;
  isGroupChat: boolean;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getMessageLineCount(msg: Message, _isSelected: boolean): number {
  // Media metadata is now inline with sender, no extra lines needed
  return msg.text.split("\n").length;
}

function getBubbleMessageLineCount(msg: Message, isGroupChat: boolean): number {
  const textLines = msg.text ? msg.text.split("\n").length : 0;
  const hasName = isGroupChat && !msg.isOutgoing;
  // name line (if group + not outgoing) + text lines (timestamp is inline on last line)
  return (hasName ? 1 : 0) + Math.max(1, textLines);
}

// 10 distinct colors for senders (no blue - that's for you)
const SENDER_COLORS = [
  "green",
  "yellow",
  "magenta",
  "red",
  "cyan",
  "white",
  "greenBright",
  "yellowBright",
  "magentaBright",
  "redBright",
] as const;

function MessageViewInner({ isFocused, selectedChatTitle, messages: chatMessages, selectedIndex, isLoadingOlder = false, canLoadOlder = false, width, dispatch, messageLayout, isGroupChat }: MessageViewProps) {
  // Handle Enter key to open media panel
  useInput((_input, key) => {
    if (key.return) {
      const selectedMessage = chatMessages[selectedIndex];
      if (selectedMessage?.media) {
        dispatch({ type: 'OPEN_MEDIA_PANEL', payload: { messageId: selectedMessage.id } });
      }
    }
  }, { isActive: isFocused });

  // Build color map: assign colors to senders in order of first appearance
  const senderColorMap = useMemo(() => {
    const map = new Map<string, typeof SENDER_COLORS[number]>();
    let colorIndex = 0;
    for (const msg of chatMessages) {
      if (!msg.isOutgoing && !map.has(msg.senderId)) {
        map.set(msg.senderId, SENDER_COLORS[colorIndex % SENDER_COLORS.length]!);
        colorIndex++;
      }
    }
    return map;
  }, [chatMessages]);

  // Get color for a sender
  const getSenderColor = (senderId: string) => {
    return senderColorMap.get(senderId) ?? "white";
  };

  // Calculate line count for each message
  const messageLineCounts = useMemo(() => {
    return chatMessages.map((msg, index) => {
      const isSelected = index === selectedIndex && isFocused;
      if (messageLayout === "bubble") {
        return getBubbleMessageLineCount(msg, isGroupChat);
      }
      return getMessageLineCount(msg, isSelected);
    });
  }, [chatMessages, selectedIndex, isFocused, messageLayout, isGroupChat]);

  const totalLines = useMemo(() => {
    return messageLineCounts.reduce((sum, count) => sum + count, 0);
  }, [messageLineCounts]);

  // Calculate visible window based on LINES, not message count
  const { startIndex, endIndex, showScrollUp, showScrollDown } = useMemo(() => {
    const total = chatMessages.length;
    if (total === 0) {
      return { startIndex: 0, endIndex: 0, showScrollUp: false, showScrollDown: false };
    }

    // Check if all messages fit
    if (totalLines <= VISIBLE_LINES) {
      return { startIndex: 0, endIndex: total, showScrollUp: false, showScrollDown: false };
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
    const availableLines = VISIBLE_LINES;

    // First pass: expand backwards
    while (start > 0) {
      const prevLines = messageLineCounts[start - 1]!;
      const wouldNeedTopIndicator = start - 1 > 0;
      const neededReserve = wouldNeedTopIndicator ? reserveTop : 0;

      if (linesUsed + prevLines + neededReserve <= availableLines - reserveBottom) {
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

      if (linesUsed + nextLines + neededReserve + topReserve <= availableLines) {
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
  }, [chatMessages.length, selectedIndex, messageLineCounts, totalLines]);

  // Get visible messages
  const visibleMessages = chatMessages.slice(startIndex, endIndex);

  // Render a single message in bubble layout
  const renderBubbleMessage = (msg: Message, isSelected: boolean, _actualIndex: number) => {
    const showName = isGroupChat && !msg.isOutgoing;
    const textLines = msg.text ? msg.text.split("\n") : [""];
    const mediaInfo = msg.media ? formatMediaMetadata(msg.media, msg.id) : "";
    const viewHint = isSelected && msg.media ? " [Enter]" : "";
    const timestamp = `[${formatTime(msg.timestamp)}]`;
    const senderColor = getSenderColor(msg.senderId);

    // Calculate padding for right-aligned messages
    const contentWidth = width - 4; // Account for borders and padding

    return (
      <Box key={msg.id} flexDirection="column">
        {/* Sender name (groups only, others only) - with unique color */}
        {showName && (
          <Text color={senderColor}>{msg.senderName || "Unknown"}</Text>
        )}

        {/* Message content with inline timestamp on last line */}
        {textLines.map((line, lineIndex) => {
          const isLastLine = lineIndex === textLines.length - 1;
          const isFirstLine = lineIndex === 0;

          // Build content for this line
          let lineContent = line;
          if (isFirstLine && mediaInfo) {
            lineContent = `${line} ${mediaInfo}${viewHint}`.trim() || `${mediaInfo}${viewHint}`;
          }

          // Add timestamp to end of last line
          const suffix = isLastLine ? ` ${timestamp}` : "";
          const fullContent = lineContent + suffix;

          if (msg.isOutgoing) {
            // Right-aligned, blue (user's messages)
            const padding = Math.max(0, contentWidth - fullContent.length);
            return (
              <Text key={lineIndex} inverse={isSelected}>
                {" ".repeat(padding)}
                <Text color="blue">{lineContent}</Text>
                {isLastLine && <Text dimColor> {timestamp}</Text>}
              </Text>
            );
          } else {
            // Left-aligned, normal text (not dim for better readability)
            return (
              <Text key={lineIndex} inverse={isSelected}>
                <Text>{lineContent}</Text>
                {isLastLine && <Text dimColor> {timestamp}</Text>}
              </Text>
            );
          }
        })}
      </Box>
    );
  };

  if (!selectedChatTitle) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={isFocused ? "cyan" : "blue"} width={width} height={VISIBLE_LINES + 3} justifyContent="center" alignItems="center">
        <Text dimColor>Select a chat to start</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={isFocused ? "cyan" : "blue"} width={width} height={VISIBLE_LINES + 3}>
      <Box paddingX={1} borderStyle="single" borderBottom borderLeft={false} borderRight={false} borderTop={false}>
        <Text bold color={isFocused ? "cyan" : undefined}>{selectedChatTitle}</Text>
        {totalLines > VISIBLE_LINES && (
          <Text dimColor> ({selectedIndex + 1}/{chatMessages.length})</Text>
        )}
      </Box>
      <Box flexDirection="column" paddingX={1} height={VISIBLE_LINES} overflowY="hidden">
        {isLoadingOlder && <Text dimColor>  Loading older messages...</Text>}
        {canLoadOlder && !isLoadingOlder && <Text color="yellow">  ↑ Press Enter to load older messages</Text>}
        {showScrollUp && !isLoadingOlder && !canLoadOlder && <Text dimColor>  ↑ {startIndex} earlier</Text>}
        {messageLayout === "bubble" ? (
          // Bubble layout rendering
          visibleMessages.map((msg, i) => {
            const actualIndex = startIndex + i;
            const isSelected = actualIndex === selectedIndex && isFocused;
            return renderBubbleMessage(msg, isSelected, actualIndex);
          })
        ) : (
          // Classic layout rendering (existing code)
          visibleMessages.map((msg, i) => {
            const actualIndex = startIndex + i;
            const isSelected = actualIndex === selectedIndex && isFocused;
            const senderName = msg.isOutgoing ? "You" : msg.senderName;
            const nbspSenderName = senderName.replace(/ /g, "\u00A0");
            const lines = msg.text.split("\n");
            const mediaInfo = msg.media ? ` ${formatMediaMetadata(msg.media, msg.id)}` : '';
            const viewHint = isSelected && msg.media ? ' [Press enter to view]' : '';

            return (
              <Box key={msg.id} flexDirection="column">
                {lines.map((line, lineIndex) => (
                  <Box key={lineIndex}>
                    <Text wrap="wrap">
                      {lineIndex === 0 ? (
                        <>
                          <Text inverse={isSelected} dimColor={!isSelected}>[{formatTime(msg.timestamp)}]{"\u00A0"}</Text>
                          <Text inverse={isSelected} bold color={msg.isOutgoing ? "blue" : getSenderColor(msg.senderId)}>{nbspSenderName}:</Text>
                          <Text inverse={isSelected} dimColor>{mediaInfo}</Text>
                          <Text inverse={isSelected}> {line}</Text>
                          <Text inverse={isSelected} color="yellow">{viewHint}</Text>
                        </>
                      ) : (
                        <Text inverse={isSelected} dimColor={!isSelected}>{"        "}{line}</Text>
                      )}
                    </Text>
                  </Box>
                ))}
              </Box>
            );
          })
        )}
        {showScrollDown && <Text dimColor>  ↓ {chatMessages.length - endIndex} more</Text>}
      </Box>
    </Box>
  );
}

export const MessageView = memo(MessageViewInner);
