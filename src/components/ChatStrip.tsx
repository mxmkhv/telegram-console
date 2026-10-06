import { memo } from "react";
import { Box, Text, useSkin } from "./ui";
import type { Chat, ChatDraft } from "../types";

const WINDOW = 3;
const TITLE_MAX = 12;

interface ChatStripProps {
  chats: Chat[];
  selectedIndex: number;
  selectedChatId: string | null;
  isFocused: boolean;
  typingChats?: Record<string, boolean>;
  drafts?: Record<string, ChatDraft>;
}

function ChatStripInner({ chats, selectedIndex, selectedChatId, isFocused, typingChats, drafts }: ChatStripProps) {
  const skin = useSkin();
  const total = chats.length;
  if (total === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No chats</Text>
      </Box>
    );
  }

  let start = Math.max(0, selectedIndex - Math.floor(WINDOW / 2));
  start = Math.min(start, Math.max(0, total - WINDOW));
  const end = Math.min(total, start + WINDOW);
  const windowChats = chats.slice(start, end);

  return (
    <Box paddingX={1}>
      {/* Single truncated line: never wraps to a 2nd row (which would push it off-screen) */}
      <Text wrap="truncate">
        <Text dimColor>{start > 0 ? "‹ " : "  "}</Text>
        {windowChats.map((chat, i) => {
          const globalIndex = start + i;
          const isHighlighted = isFocused && globalIndex === selectedIndex;
          const isActive = chat.id === selectedChatId;
          const hasUnread = chat.unreadCount > 0;
          // claudeCode's active-chat color/bold already signal selection, so the
          // caret glyph in front of it would be a redundant marker there.
          const prefix = isActive
            ? skin.name === "claudeCode" ? "" : skin.glyphs.caret
            : chat.isGroup ? "#" : "";
          const title = chat.title.slice(0, TITLE_MAX);
          const isLast = i === windowChats.length - 1;
          const isTyping = !!typingChats?.[chat.id];
          const hasDraft = !isActive && !!drafts?.[chat.id];
          return (
            <Text key={chat.id}>
              {isTyping && <Text dimColor>…</Text>}
              {hasDraft && <Text dimColor>✎</Text>}
              <Text
                inverse={isHighlighted}
                bold={isActive || hasUnread}
                color={isActive ? "cyan" : hasUnread ? "yellow" : undefined}
              >
                {prefix}
                {title}
              </Text>
              {!isLast && <Text dimColor> · </Text>}
            </Text>
          );
        })}
        <Text dimColor>{end < total ? " ›" : ""}</Text>
      </Text>
    </Box>
  );
}

export const ChatStrip = memo(ChatStripInner);
