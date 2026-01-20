import React, { memo, useMemo } from "react";
import { Box, Text } from "ink";
import type { Chat } from "../types";

const VISIBLE_ITEMS = 15;

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  selectedIndex: number;
  isFocused: boolean;
}

function ChatListInner({ chats, selectedChatId, onSelectChat: _onSelectChat, selectedIndex, isFocused }: ChatListProps) {
  // Calculate visible window to keep selectedIndex in view
  const { startIndex, endIndex } = useMemo(() => {
    const total = chats.length;
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
  }, [chats, selectedIndex]);

  const showScrollUp = startIndex > 0;
  const showScrollDown = endIndex < chats.length;

  // Adjust visible range to account for scroll indicators
  const adjustedStart = showScrollUp ? startIndex + 1 : startIndex;
  const adjustedEnd = showScrollDown ? endIndex - 1 : endIndex;
  const visibleChats = chats.slice(adjustedStart, adjustedEnd);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={isFocused ? "cyan" : undefined} width={35} height={VISIBLE_ITEMS + 3}>
      <Box paddingX={1} borderStyle="single" borderBottom borderLeft={false} borderRight={false} borderTop={false}>
        <Text bold color={isFocused ? "cyan" : undefined}>Chats</Text>
        {chats.length > VISIBLE_ITEMS && (
          <Text dimColor> ({selectedIndex + 1}/{chats.length})</Text>
        )}
      </Box>
      <Box flexDirection="column" paddingX={1} height={VISIBLE_ITEMS}>
        {showScrollUp && <Text dimColor>  ↑ {startIndex} more</Text>}
        {visibleChats.map((chat, i) => {
          const actualIndex = adjustedStart + i;
          const isSelected = actualIndex === selectedIndex && isFocused;
          const isActive = chat.id === selectedChatId;
          const hasUnread = chat.unreadCount > 0;

          return (
            <Box key={chat.id}>
              <Text
                inverse={isSelected}
                bold={hasUnread || isActive}
                color={isActive ? "cyan" : undefined}
              >
                {hasUnread ? "● " : "  "}
                {chat.title.slice(0, 28)}
                {hasUnread ? ` (${chat.unreadCount})` : ""}
              </Text>
            </Box>
          );
        })}
        {showScrollDown && <Text dimColor>  ↓ {chats.length - endIndex} more</Text>}
      </Box>
    </Box>
  );
}

export const ChatList = memo(ChatListInner);
