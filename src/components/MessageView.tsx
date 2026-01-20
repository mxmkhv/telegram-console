import React, { memo, useMemo } from "react";
import { Box, Text } from "ink";
import type { Message } from "../types";

const VISIBLE_ITEMS = 15;

interface MessageViewProps {
  isFocused: boolean;
  selectedChatTitle: string | null;
  messages: Message[];
  selectedIndex: number;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function MessageViewInner({ isFocused, selectedChatTitle, messages: chatMessages, selectedIndex }: MessageViewProps) {
  // Calculate visible window to keep selectedIndex in view
  const { startIndex, endIndex } = useMemo(() => {
    const total = chatMessages.length;
    if (total <= VISIBLE_ITEMS) {
      return { startIndex: 0, endIndex: total };
    }

    // Keep selection visible with some context
    let start = Math.max(0, selectedIndex - Math.floor(VISIBLE_ITEMS / 2));
    start = Math.min(start, total - VISIBLE_ITEMS);

    return {
      startIndex: start,
      endIndex: start + VISIBLE_ITEMS,
    };
  }, [chatMessages.length, selectedIndex]);

  const showScrollUp = startIndex > 0;
  const showScrollDown = endIndex < chatMessages.length;

  // Adjust visible range to account for scroll indicators
  const adjustedStart = showScrollUp ? startIndex + 1 : startIndex;
  const adjustedEnd = showScrollDown ? endIndex - 1 : endIndex;
  const visibleMessages = chatMessages.slice(adjustedStart, adjustedEnd);

  if (!selectedChatTitle) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? "cyan" : undefined} flexGrow={1} height={VISIBLE_ITEMS + 3} justifyContent="center" alignItems="center">
        <Text dimColor>Select a chat to start</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? "cyan" : undefined} flexGrow={1} height={VISIBLE_ITEMS + 3}>
      <Box paddingX={1} borderStyle="single" borderBottom borderLeft={false} borderRight={false} borderTop={false}>
        <Text bold color={isFocused ? "cyan" : undefined}>{selectedChatTitle}</Text>
        {chatMessages.length > VISIBLE_ITEMS && (
          <Text dimColor> ({selectedIndex + 1}/{chatMessages.length})</Text>
        )}
      </Box>
      <Box flexDirection="column" paddingX={1} height={VISIBLE_ITEMS}>
        {showScrollUp && <Text dimColor>  ↑ {startIndex} earlier</Text>}
        {visibleMessages.map((msg, i) => {
          const actualIndex = adjustedStart + i;
          const isSelected = actualIndex === selectedIndex && isFocused;

          return (
            <Box key={msg.id}>
              <Text inverse={isSelected} dimColor={!isSelected}>[{formatTime(msg.timestamp)}] </Text>
              <Text inverse={isSelected} bold color={msg.isOutgoing ? "cyan" : "white"}>
                {msg.isOutgoing ? "You" : msg.senderName}:
              </Text>
              <Text inverse={isSelected}> {msg.text}</Text>
            </Box>
          );
        })}
        {showScrollDown && <Text dimColor>  ↓ {chatMessages.length - endIndex} more</Text>}
      </Box>
    </Box>
  );
}

export const MessageView = memo(MessageViewInner);
