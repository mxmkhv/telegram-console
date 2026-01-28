import React, { useState, useEffect, useRef, memo } from "react";
import { Box, Text, useInput } from "ink";
import type { Message } from "../types";

interface InputBarProps {
  isFocused: boolean;
  onSubmit: (text: string, chatId: string) => void;
  onEdit?: (text: string, chatId: string, messageId: number) => void;
  onStartEdit?: () => void;
  selectedChatId: string | null;
  replyingToMessage?: Message | null;
  editingMessage?: Message | null;
  onCancelReply?: () => void;
  onCancelEdit?: () => void;
}

// Combined state to avoid race conditions between value and cursor
interface InputState {
  value: string;
  cursor: number;
}

function InputBarInner({
  isFocused,
  onSubmit,
  onEdit,
  onStartEdit,
  selectedChatId,
  replyingToMessage,
  editingMessage,
  onCancelReply,
  onCancelEdit,
}: InputBarProps) {
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

  // Populate input when entering edit mode
  useEffect(() => {
    if (editingMessage) {
      setState({
        value: editingMessage.text,
        cursor: editingMessage.text.length,
      });
    }
  }, [editingMessage]);

  // Custom input handler - atomic state updates prevent character flipping
  useInput(
    (input, key) => {
      // Escape: cancel reply/edit mode
      if (key.escape) {
        if (editingMessage && onCancelEdit) {
          onCancelEdit();
          setState({ value: "", cursor: 0 });
          return;
        }
        if (replyingToMessage && onCancelReply) {
          onCancelReply();
          return;
        }
        return;
      }

      // Up arrow: enter edit mode when input is empty
      if (key.upArrow && state.value === "" && !editingMessage && !replyingToMessage) {
        onStartEdit?.();
        return;
      }

      // Submit on Enter
      if (key.return) {
        setState((s) => {
          if (s.value.trim() && selectedChatId) {
            // Edit mode: call onEdit
            if (editingMessage && onEdit) {
              if (s.value.trim() !== editingMessage.text) {
                onEdit(s.value.trim(), selectedChatId, editingMessage.id);
              }
              onCancelEdit?.();
              return { value: "", cursor: 0 };
            }
            // Normal/Reply mode: call onSubmit
            onSubmit(s.value.trim(), selectedChatId);
            onCancelReply?.();
            return { value: "", cursor: 0 };
          }
          return s;
        });
        return;
      }

      // Delete character before cursor
      if (key.backspace || key.delete) {
        setState((s) => {
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
        setState((s) => ({ ...s, cursor: Math.max(0, s.cursor - 1) }));
        return;
      }

      // Cursor movement - right
      if (key.rightArrow) {
        setState((s) => ({ ...s, cursor: Math.min(s.value.length, s.cursor + 1) }));
        return;
      }

      // Home (Ctrl+A)
      if (key.ctrl && input === "a") {
        setState((s) => ({ ...s, cursor: 0 }));
        return;
      }

      // End (Ctrl+E)
      if (key.ctrl && input === "e") {
        setState((s) => ({ ...s, cursor: s.value.length }));
        return;
      }

      // Insert character at cursor position
      if (input && !key.ctrl && !key.meta) {
        setState((s) => ({
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

  // Render text with cursor
  const safeCursor = Math.min(cursor, value.length);
  const beforeCursor = value.slice(0, safeCursor);
  const atCursor = value[safeCursor] || " ";
  const afterCursor = value.slice(safeCursor + 1);

  // Determine mode indicator
  const modeIndicator = editingMessage
    ? "✎ Editing..."
    : replyingToMessage
      ? `↩ Replying to ${replyingToMessage.senderName}...`
      : null;

  return (
    <Box flexDirection="column" width="100%">
      {/* Mode indicator */}
      {modeIndicator && (
        <Box paddingX={1}>
          <Text dimColor>{modeIndicator} (Esc to cancel)</Text>
        </Box>
      )}
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
    </Box>
  );
}

// Custom comparison to prevent unnecessary re-renders
export const InputBar = memo(InputBarInner, (prev, next) => {
  return (
    prev.isFocused === next.isFocused &&
    prev.selectedChatId === next.selectedChatId &&
    prev.onSubmit === next.onSubmit &&
    prev.onEdit === next.onEdit &&
    prev.replyingToMessage === next.replyingToMessage &&
    prev.editingMessage === next.editingMessage
  );
});
