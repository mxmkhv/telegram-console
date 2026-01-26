import React, { useState, useEffect, useRef, memo } from "react";
import { Box, Text, useInput } from "ink";

interface InputBarProps {
  isFocused: boolean;
  onSubmit: (text: string, chatId: string) => void;
  selectedChatId: string | null;
}

// Combined state to avoid race conditions between value and cursor
interface InputState {
  value: string;
  cursor: number;
}

function InputBarInner({ isFocused, onSubmit, selectedChatId }: InputBarProps) {
  // Single state object prevents race conditions between value and cursor updates
  const [state, setState] = useState<InputState>({ value: "", cursor: 0 });
  const prevChatIdRef = useRef(selectedChatId);

  // Clear input when chat changes
  useEffect(() => {
    if (selectedChatId !== prevChatIdRef.current) {
      setState({ value: "", cursor: 0 });
      prevChatIdRef.current = selectedChatId;
    }
  }, [selectedChatId]);

  // Custom input handler - atomic state updates prevent character flipping
  useInput(
    (input, key) => {
      // Submit on Enter
      if (key.return) {
        setState(s => {
          if (s.value.trim() && selectedChatId) {
            onSubmit(s.value.trim(), selectedChatId);
            return { value: "", cursor: 0 };
          }
          return s;
        });
        return;
      }

      // Delete character before cursor
      if (key.backspace || key.delete) {
        setState(s => {
          if (s.cursor > 0) {
            return {
              value: s.value.slice(0, s.cursor - 1) + s.value.slice(s.cursor),
              cursor: s.cursor - 1,
            };
          }
          return s;
        });
        return;
      }

      // Cursor movement - left
      if (key.leftArrow) {
        setState(s => ({ ...s, cursor: Math.max(0, s.cursor - 1) }));
        return;
      }

      // Cursor movement - right
      if (key.rightArrow) {
        setState(s => ({ ...s, cursor: Math.min(s.value.length, s.cursor + 1) }));
        return;
      }

      // Home (Ctrl+A)
      if (key.ctrl && input === "a") {
        setState(s => ({ ...s, cursor: 0 }));
        return;
      }

      // End (Ctrl+E)
      if (key.ctrl && input === "e") {
        setState(s => ({ ...s, cursor: s.value.length }));
        return;
      }

      // Insert character at cursor position - atomic update
      if (input && !key.ctrl && !key.meta) {
        setState(s => ({
          value: s.value.slice(0, s.cursor) + input + s.value.slice(s.cursor),
          cursor: s.cursor + input.length,
        }));
      }
    },
    { isActive: isFocused }
  );

  const { value, cursor } = state;
  const placeholder = selectedChatId ? "Type a message..." : "Select a chat first";
  const showPlaceholder = !value && !isFocused;

  // Render text with cursor - clamp cursor to valid range
  const safeCursor = Math.min(cursor, value.length);
  const beforeCursor = value.slice(0, safeCursor);
  const atCursor = value[safeCursor] || " ";
  const afterCursor = value.slice(safeCursor + 1);

  return (
    <Box
      width="100%"
      minHeight={3}
      borderStyle="round"
      borderColor={isFocused ? "cyan" : "blue"}
      paddingX={1}
    >
      <Text bold color={isFocused ? "cyan" : "white"}>{">"} </Text>
      <Box flexGrow={1}>
        {showPlaceholder ? (
          <Text dimColor>{placeholder}</Text>
        ) : (
          <Text>
            <Text>{beforeCursor}</Text>
            <Text inverse={isFocused}>{atCursor}</Text>
            <Text>{afterCursor}</Text>
          </Text>
        )}
      </Box>
    </Box>
  );
}

// Custom comparison to prevent unnecessary re-renders
export const InputBar = memo(InputBarInner, (prev, next) => {
  return (
    prev.isFocused === next.isFocused &&
    prev.selectedChatId === next.selectedChatId &&
    prev.onSubmit === next.onSubmit
  );
});