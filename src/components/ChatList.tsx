import { memo, useMemo, useEffect } from "react";
import { Box, Text, useSkin } from "./ui";
import type { Chat, ChatDraft, LoadStatus } from "../types";
import { useFlash } from "../hooks/useFlash.js";
import { useTelegramService } from "../state/context.js";
import { FLASH_CONFIG } from "../config/flashConfig.js";
import { formatChatTime } from "../utils/formatDate.js";
import { getMessagePreview } from "../utils/messagePreview.js";

// Layout constants
const INDICATOR_LINES = 2; // Top and bottom scroll indicators
const HEADER_LINES = 2; // Header text + border
const BORDER_LINES = 2; // Round border top + bottom

// Each chat takes a title row and a preview row
const ROWS_PER_CHAT = 2;
// Lines the preview up under the title, past the unread and group markers
const PREVIEW_INDENT = "    ";

// Memoized row component
const ChatRow = memo(function ChatRow({
  chat,
  isSelected,
  isActive,
  isFlashing,
  isTyping,
  draftText,
}: {
  chat: Chat;
  isSelected: boolean;
  isActive: boolean;
  isFlashing: boolean;
  isTyping: boolean;
  draftText: string | undefined;
}) {
  const hasUnread = chat.unreadCount > 0;
  const highlighted = isSelected || isFlashing;
  const titleStyle = { inverse: highlighted, bold: hasUnread || isActive, color: isActive ? "cyan" : undefined };
  const time = chat.lastMessage ? formatChatTime(chat.lastMessage.timestamp) : "";
  const preview = chat.lastMessage ? getMessagePreview(chat.lastMessage, chat.isGroup) : "";

  // Only the title and preview shrink: Ink truncates them by display width
  // (CJK-safe), so the time and unread count always stay visible.
  return (
    <Box flexDirection="column">
      <Box height={1}>
        <Box flexShrink={0}>
          <Text color={hasUnread ? "cyan" : undefined} inverse={highlighted}>
            {hasUnread ? "● " : "  "}
          </Text>
          <Text color={chat.isGroup ? "magenta" : undefined} inverse={highlighted}>
            {chat.isGroup ? "# " : "  "}
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text wrap="truncate" {...titleStyle}>
            {chat.title}
          </Text>
        </Box>
        {time && (
          <Box flexShrink={0}>
            <Text dimColor={!hasUnread} color={hasUnread ? "cyan" : undefined}>
              {" "}
              {time}
            </Text>
          </Box>
        )}
      </Box>
      <Box height={1}>
        <Box flexShrink={0}>
          <Text>{PREVIEW_INDENT}</Text>
        </Box>
        <Box flexGrow={1}>
          {isTyping ? (
            <Text color="cyan" italic wrap="truncate">
              typing…
            </Text>
          ) : draftText !== undefined ? (
            <Text wrap="truncate">
              <Text color="yellow">✎ Draft: </Text>
              <Text dimColor>{draftText}</Text>
            </Text>
          ) : (
            <Text dimColor wrap="truncate">
              {preview}
            </Text>
          )}
        </Box>
        {hasUnread && (
          <Box flexShrink={0}>
            <Text color="cyan" bold>
              {" "}
              {chat.unreadCount}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
});

function ChatListPlaceholder({ status }: { status: LoadStatus }) {
  if (status === "error") {
    return (
      <>
        <Text color="red" wrap="truncate">
          Couldn't load chats
        </Text>
        <Text dimColor wrap="truncate">
          Press Ctrl+R to retry
        </Text>
      </>
    );
  }
  return (
    <Text dimColor wrap="truncate">
      {status === "loading" ? "Loading chats…" : "No chats yet"}
    </Text>
  );
}

interface ChatListProps {
  chats: Chat[];
  status: LoadStatus;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  selectedIndex: number;
  isFocused: boolean;
  height?: number;
  width?: number;
  typingChats?: Record<string, boolean>;
  drafts?: Record<string, ChatDraft>;
}

function ChatListInner({ chats, status, selectedChatId, onSelectChat: _onSelectChat, selectedIndex, isFocused, height = 24, width = 35, typingChats, drafts }: ChatListProps) {
  const skin = useSkin();
  // A single right-edge divider (panelDividers skins) doesn't consume any rows,
  // unlike a full round border's top+bottom border rows.
  const borderLines = skin.panelDividers ? 0 : BORDER_LINES;
  const listHeight = Math.max(1, height - (INDICATOR_LINES + HEADER_LINES + borderLines));
  const visibleCount = Math.max(1, Math.floor(listHeight / ROWS_PER_CHAT));
  const { visibleChats, visibleStartIndex, itemsAbove, itemsBelow } = useMemo(() => {
    const total = chats.length;

    if (total <= visibleCount) {
      return {
        visibleChats: chats,
        visibleStartIndex: 0,
        itemsAbove: 0,
        itemsBelow: 0,
      };
    }

    let start = Math.max(0, selectedIndex - Math.floor(visibleCount / 2));
    start = Math.min(start, total - visibleCount);
    const end = start + visibleCount;

    return {
      visibleChats: chats.slice(start, end),
      visibleStartIndex: start,
      itemsAbove: start,
      itemsBelow: total - end,
    };
  }, [chats, selectedIndex, visibleCount]);

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
        {chats.length > visibleCount && (
          <Text dimColor> ({selectedIndex + 1}/{chats.length})</Text>
        )}
      </Box>

      {/* List area */}
      <Box flexDirection="column" paddingX={1}>
        {/* Top indicator */}
        <Text dimColor>{itemsAbove > 0 ? `  ↑ ${itemsAbove} more` : " "}</Text>

        {chats.length === 0 && <ChatListPlaceholder status={status} />}

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
              draftText={chat.id !== selectedChatId ? drafts?.[chat.id]?.text : undefined}
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
