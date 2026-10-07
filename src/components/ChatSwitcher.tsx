import { memo, useMemo, useState } from "react";
import { useInput } from "ink";
import { Box, Text } from "./ui";
import type { Chat } from "../types";
import { rankByFuzzyMatch } from "../utils/fuzzyMatch";

interface ChatSwitcherProps {
  chats: Chat[];
  onSelect: (chatId: string) => void;
  onClose: () => void;
  width: number;
  maxRows: number;
}

// Title with the matched characters highlighted
function HighlightedTitle({ title, matched, isSelected }: { title: string; matched: Set<number>; isSelected: boolean }) {
  const segments: { text: string; isMatch: boolean }[] = [];
  let offset = 0;
  for (const char of title) {
    const isMatch = matched.has(offset);
    const last = segments.at(-1);
    if (last && last.isMatch === isMatch) last.text += char;
    else segments.push({ text: char, isMatch });
    offset += char.length;
  }
  return (
    <Text wrap="truncate" inverse={isSelected}>
      {segments.map((segment, i) => (
        <Text key={i} bold={segment.isMatch} color={segment.isMatch ? "cyan" : undefined}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

function ChatSwitcherInner({ chats, onSelect, onClose, width, maxRows }: ChatSwitcherProps) {
  const [query, setQuery] = useState("");
  // Track the chat, not the row: new messages reorder chats while open
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const results = useMemo(() => rankByFuzzyMatch(chats, query, (chat) => chat.title), [chats, query]);
  const rowCount = Math.max(1, maxRows);
  const index = Math.max(0, results.findIndex((r) => r.item.id === selectedId));
  const selectRow = (row: number) => setSelectedId(results[row]?.item.id ?? null);
  // Keep the selection in view
  const start = Math.max(0, Math.min(index - rowCount + 1, results.length - rowCount));
  const visible = results.slice(Math.max(0, start), Math.max(0, start) + rowCount);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
    } else if (key.return) {
      const chat = results[index]?.item;
      if (chat) onSelect(chat.id);
    } else if (key.upArrow || (key.ctrl && input === "p")) {
      selectRow(Math.max(0, index - 1));
    } else if (key.downArrow || (key.ctrl && input === "n")) {
      selectRow(Math.min(results.length - 1, index + 1));
    } else if (key.backspace || key.delete) {
      setQuery((q) => Array.from(q).slice(0, -1).join(""));
      setSelectedId(null);
    } else if (input && !key.ctrl && !key.meta && !key.tab) {
      setQuery((q) => q + input);
      setSelectedId(null);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width}>
      <Text bold color="cyan">
        Go to chat
      </Text>
      <Box>
        <Text color="cyan">{"> "}</Text>
        <Text wrap="truncate">{query}</Text>
        <Text inverse> </Text>
      </Box>
      <Text dimColor>{"─".repeat(Math.max(0, width - 4))}</Text>
      {results.length === 0 ? (
        <Text dimColor wrap="truncate">
          No chats match "{query}"
        </Text>
      ) : (
        visible.map(({ item: chat, match }, i) => {
          const isSelected = Math.max(0, start) + i === index;
          return (
            <Box key={chat.id} height={1}>
              <Box flexShrink={0}>
                <Text inverse={isSelected} color={chat.unreadCount > 0 ? "cyan" : undefined}>
                  {chat.unreadCount > 0 ? "● " : "  "}
                </Text>
                <Text inverse={isSelected} color={chat.isGroup ? "magenta" : undefined}>
                  {chat.isGroup ? "# " : "  "}
                </Text>
              </Box>
              <HighlightedTitle title={chat.title} matched={match.matched} isSelected={isSelected} />
              {chat.unreadCount > 0 && (
                <Box flexShrink={0}>
                  <Text inverse={isSelected} bold>
                    {` (${chat.unreadCount})`}
                  </Text>
                </Box>
              )}
            </Box>
          );
        })
      )}
      <Text dimColor wrap="truncate">
        ↑↓ select · Enter open · Esc close
      </Text>
    </Box>
  );
}

export const ChatSwitcher = memo(ChatSwitcherInner);
