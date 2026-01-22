import { memo, useMemo, useCallback, type Dispatch } from "react";
import { Box, Text, useInput } from "ink";
import type { Message, TelegramService } from "../types";
import { MediaPlaceholder } from './MediaPlaceholder.js';
import { MediaPreview } from './MediaPreview.js';
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
  telegramService: TelegramService | null;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getMessageLineCount(msg: Message, isSelected: boolean): number {
  let lines = msg.text.split("\n").length;
  if (msg.media) {
    lines += 1; // Add 1 line for MediaPlaceholder
    if (isSelected && !msg.media.isAnimated) {
      lines += 6; // inline preview height
    }
  }
  return lines;
}

function MessageViewInner({ isFocused, selectedChatTitle, messages: chatMessages, selectedIndex, isLoadingOlder = false, canLoadOlder = false, width, dispatch, telegramService }: MessageViewProps) {

  const downloadMedia = useCallback((message: Message) => {
    if (!telegramService) return Promise.resolve(undefined);
    return telegramService.downloadMedia(message);
  }, [telegramService]);

  // Handle Enter key to open media panel
  useInput((_input, key) => {
    if (key.return) {
      const selectedMessage = chatMessages[selectedIndex];
      if (selectedMessage?.media) {
        dispatch({ type: 'OPEN_MEDIA_PANEL', payload: { messageId: selectedMessage.id } });
      }
    }
  }, { isActive: isFocused });

  // Calculate line count for each message
  const messageLineCounts = useMemo(() => {
    return chatMessages.map((msg, index) => {
      const isSelected = index === selectedIndex && isFocused;
      return getMessageLineCount(msg, isSelected);
    });
  }, [chatMessages, selectedIndex, isFocused]);

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
        {visibleMessages.map((msg, i) => {
          const actualIndex = startIndex + i;
          const isSelected = actualIndex === selectedIndex && isFocused;
          const senderName = msg.isOutgoing ? "You" : msg.senderName;
          // Replace spaces in sender name with non-breaking spaces to prevent wrapping
          const nbspSenderName = senderName.replace(/ /g, "\u00A0");
          // Split message into lines to handle newlines properly
          const lines = msg.text.split("\n");

          return (
            <Box key={msg.id} flexDirection="column">
              {lines.map((line, lineIndex) => (
                <Box key={lineIndex}>
                  <Text wrap="wrap">
                    {lineIndex === 0 ? (
                      <>
                        <Text inverse={isSelected} dimColor={!isSelected}>[{formatTime(msg.timestamp)}]{"\u00A0"}</Text>
                        <Text inverse={isSelected} bold color={msg.isOutgoing ? "cyan" : "white"}>{nbspSenderName}:</Text>
                        <Text inverse={isSelected}> {line}</Text>
                      </>
                    ) : (
                      <Text inverse={isSelected} dimColor={!isSelected}>{"        "}{line}</Text>
                    )}
                  </Text>
                </Box>
              ))}
              {msg.media && (
                <MediaPlaceholder media={msg.media} messageId={msg.id} />
              )}
              {isSelected && msg.media && !msg.media.isAnimated && (
                <MediaPreview message={msg} downloadMedia={downloadMedia} />
              )}
            </Box>
          );
        })}
        {showScrollDown && <Text dimColor>  ↓ {chatMessages.length - endIndex} more</Text>}
      </Box>
    </Box>
  );
}

export const MessageView = memo(MessageViewInner);
