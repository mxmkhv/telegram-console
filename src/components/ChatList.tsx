import { memo, useMemo, useEffect } from "react";
import { Box, Text, useSkin } from "./ui";
import type { Chat, ChatDraft } from "../types";
import { useFlash } from "../hooks/useFlash.js";
import { useTelegramService } from "../state/context.js";
import { FLASH_CONFIG } from "../config/flashConfig.js";

// Layout constants
const INDICATOR_LINES = 2; // Top and bottom scroll indicators
const HEADER_LINES = 2; // Header text + border
const BORDER_LINES = 2; // Round border top + bottom

// Memoized row component
const ChatRow = memo(function ChatRow({
  chat,
  isSelected,
  isActive,
  isFlashing,
  isTyping,
  hasDraft,
}: {
  chat: Chat;
  isSelected: boolean;
  isActive: boolean;
  isFlashing: boolean;
  isTyping: boolean;
  hasDraft: boolean;
}) {
  const hasUnread = chat.unreadCount > 0;
  const unreadIndicator = hasUnread ? "● " : "  ";
  const groupIndicator = chat.isGroup ? "# " : "  ";
  const suffix = hasUnread ? ` (${chat.unreadCount})` : "";
  const highlighted = isSelected || isFlashing;
  const titleStyle = { inverse: highlighted, bold: hasUnread || isActive, color: isActive ? "cyan" : undefined };

  // Only the title shrinks: Ink truncates it by display width (CJK-safe), so
  // the draft marker, unread count and typing marker always stay visible.
  return (
    <Box height={1}>
      <Box flexShrink={0}>
        <Text color={hasUnread ? "cyan" : undefined} inverse={highlighted}>
          {unreadIndicator}
        </Text>
        <Text color={chat.isGroup ? "magenta" : undefined} inverse={highlighted}>
          {groupIndicator}
        </Text>
      </Box>
      <Text wrap="truncate" {...titleStyle}>
        {chat.title}
      </Text>
      <Box flexShrink={0}>
        {hasDraft && (
          <Text {...titleStyle} dimColor>
            {" ✎"}
          </Text>
        )}
        {suffix && <Text {...titleStyle}>{suffix}</Text>}
        {isTyping && <Text dimColor> …</Text>}
      </Box>
    </Box>
  );
});

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  selectedIndex: number;
  isFocused: boolean;
  height?: number;
  width?: number;
  typingChats?: Record<string, boolean>;
  drafts?: Record<string, ChatDraft>;
}

function ChatListInner({ chats, selectedChatId, onSelectChat: _onSelectChat, selectedIndex, isFocused, height = 24, width = 35, typingChats, drafts }: ChatListProps) {
  const skin = useSkin();
  // A single right-edge divider (panelDividers skins) doesn't consume any rows,
  // unlike a full round border's top+bottom border rows.
  const borderLines = skin.panelDividers ? 0 : BORDER_LINES;
  const listHeight = Math.max(1, height - (INDICATOR_LINES + HEADER_LINES + borderLines));
  const { visibleChats, visibleStartIndex, itemsAbove, itemsBelow } = useMemo(() => {
    const total = chats.length;

    if (total <= listHeight) {
      return {
        visibleChats: chats,
        visibleStartIndex: 0,
        itemsAbove: 0,
        itemsBelow: 0,
      };
    }

    let start = Math.max(0, selectedIndex - Math.floor(listHeight / 2));
    start = Math.min(start, total - listHeight);
    const end = start + listHeight;

    return {
      visibleChats: chats.slice(start, end),
      visibleStartIndex: start,
      itemsAbove: start,
      itemsBelow: total - end,
    };
  }, [chats, selectedIndex, listHeight]);

  const { startFlash, stopFlash, isFlashing } = useFlash();
  const telegramService = useTelegramService();

  // Subscribe to new messages for flash
  useEffect(() => {
    if (!telegramService) return;
    const unsub = telegramService.onNewMessage((message, chatId) => {
      if (!message.isOutgoing && chatId !== selectedChatId) {
        startFlash(chatId, FLASH_CONFIG.chatFlashCount);
      }
    });
    return unsub;
  }, [telegramService, selectedChatId, startFlash]);

  // Stop flash when chat is selected
  useEffect(() => {
    if (FLASH_CONFIG.stopOnSelect && selectedChatId) {
      stopFlash(selectedChatId);
    }
  }, [selectedChatId, stopFlash]);

  return (
    <Box
      flexDirection="column"
      {...(skin.panelDividers
        ? {
            borderStyle: "single" as const,
            borderTop: false,
            borderBottom: false,
            borderLeft: false,
            borderRight: true,
            borderColor: "gray",
          }
        : { borderStyle: "round" as const, borderColor: isFocused ? "cyan" : "blue" })}
      width={width}
      height={height}
    >
      {/* Header */}
      <Box paddingX={1} borderStyle="single" borderBottom borderLeft={false} borderRight={false} borderTop={false}>
        <Text bold color={isFocused ? "cyan" : undefined}>Chats</Text>
        {chats.length > listHeight && (
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
              isFlashing={isFlashing(chat.id)}
              isTyping={!!typingChats?.[chat.id]}
              // The open chat's draft is live in the input, not pending
              hasDraft={chat.id !== selectedChatId && !!drafts?.[chat.id]}
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
