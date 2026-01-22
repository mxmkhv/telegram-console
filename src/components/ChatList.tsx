import { memo, useMemo } from "react";
import { Box, Text } from "ink";
import type { Chat } from "../types";

// Layout constants
const LIST_HEIGHT = 18; // Number of chat items to show
const INDICATOR_LINES = 2; // Top and bottom scroll indicators
const HEADER_LINES = 2; // Header text + border
const BORDER_LINES = 2; // Round border top + bottom
const TOTAL_HEIGHT = LIST_HEIGHT + INDICATOR_LINES + HEADER_LINES + BORDER_LINES; // 24

// Memoized row component
const ChatRow = memo(function ChatRow({
  chat,
  isSelected,
  isActive,
}: {
  chat: Chat;
  isSelected: boolean;
  isActive: boolean;
}) {
  const hasUnread = chat.unreadCount > 0;
  const unreadIndicator = hasUnread ? "● " : "  ";
  const groupIndicator = chat.isGroup ? "# " : "  ";
  const title = chat.title.slice(0, 26);
  const suffix = hasUnread ? ` (${chat.unreadCount})` : "";

  return (
    <Text>
      <Text color={hasUnread ? "cyan" : undefined} inverse={isSelected}>
        {unreadIndicator}
      </Text>
      <Text color={chat.isGroup ? "magenta" : undefined} inverse={isSelected}>
        {groupIndicator}
      </Text>
      <Text
        inverse={isSelected}
        bold={hasUnread || isActive}
        color={isActive ? "cyan" : undefined}
      >
        {title}{suffix}
      </Text>
    </Text>
  );
});

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  selectedIndex: number;
  isFocused: boolean;
}

function ChatListInner({ chats, selectedChatId, onSelectChat: _onSelectChat, selectedIndex, isFocused }: ChatListProps) {
  const { visibleChats, visibleStartIndex, itemsAbove, itemsBelow } = useMemo(() => {
    const total = chats.length;

    if (total <= LIST_HEIGHT) {
      return {
        visibleChats: chats,
        visibleStartIndex: 0,
        itemsAbove: 0,
        itemsBelow: 0,
      };
    }

    let start = Math.max(0, selectedIndex - Math.floor(LIST_HEIGHT / 2));
    start = Math.min(start, total - LIST_HEIGHT);
    const end = start + LIST_HEIGHT;

    return {
      visibleChats: chats.slice(start, end),
      visibleStartIndex: start,
      itemsAbove: start,
      itemsBelow: total - end,
    };
  }, [chats, selectedIndex]);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isFocused ? "cyan" : "blue"}
      width={35}
      height={TOTAL_HEIGHT}
    >
      {/* Header */}
      <Box paddingX={1} borderStyle="single" borderBottom borderLeft={false} borderRight={false} borderTop={false}>
        <Text bold color={isFocused ? "cyan" : undefined}>Chats</Text>
        {chats.length > LIST_HEIGHT && (
          <Text dimColor> ({selectedIndex + 1}/{chats.length})</Text>
        )}
      </Box>

      {/* List area */}
      <Box flexDirection="column" paddingX={1}>
        {/* Top indicator */}
        <Text dimColor>{itemsAbove > 0 ? `  ↑ ${itemsAbove} more` : " "}</Text>

        {/* Chat items - one Text per line, newline separated */}
        {visibleChats.map((chat, i) => {
          const globalIndex = visibleStartIndex + i;
          return (
            <ChatRow
              key={chat.id}
              chat={chat}
              isSelected={isFocused && globalIndex === selectedIndex}
              isActive={chat.id === selectedChatId}
            />
          );
        })}

        {/* Bottom indicator */}
        <Text dimColor>{itemsBelow > 0 ? `  ↓ ${itemsBelow} more` : " "}</Text>
      </Box>
    </Box>
  );
}

export const ChatList = memo(ChatListInner);
