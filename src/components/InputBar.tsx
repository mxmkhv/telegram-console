import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { useInput } from "ink";
import { Box, Text, useSkin } from "./ui";
import type { Message, ImageSendResult, ChatDraft } from "../types";
import { transformEmoticons } from "../utils/emoticonMap";

interface InputBarProps {
  isFocused: boolean;
  onSubmit: (text: string, chatId: string) => void;
  onEdit?: (text: string, chatId: string, messageId: number) => void;
  onSendImage?: (chatId: string) => Promise<ImageSendResult>;
  onStartEdit?: () => void;
  selectedChatId: string | null;
  replyingToMessage?: Message | null;
  editingMessage?: Message | null;
  onCancelReply?: () => void;
  onCancelEdit?: () => void;
  // Read on mount only - the parent keys InputBar by chat to restore drafts
  initialText?: string;
  // Called on unmount with the chat's text and reply/edit context
  onSaveDraft?: (chatId: string, draft: ChatDraft) => void;
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
  onSendImage,
  onStartEdit,
  selectedChatId,
  replyingToMessage,
  editingMessage,
  onCancelReply,
  onCancelEdit,
  initialText = "",
  onSaveDraft,
}: InputBarProps) {
  // Single state object prevents race conditions between value and cursor updates
  const [state, setState] = useState<InputState>(() => ({
    value: initialText,
    cursor: initialText.length,
  }));
  const skin = useSkin();

  // Save the draft on unmount. The parent keys InputBar by chat, so the last
  // committed snapshot still holds the previous chat's text and reply/edit.
  const snapshot = {
    chatId: selectedChatId,
    onSaveDraft,
    text: state.value,
    replyTo: replyingToMessage ?? null,
    editing: editingMessage ?? null,
  };
  const draftSnapshot = useRef(snapshot);
  useEffect(() => {
    draftSnapshot.current = snapshot;
  });
  useEffect(
    () => () => {
      const { chatId, onSaveDraft: save, ...draft } = draftSnapshot.current;
      if (chatId) save?.(chatId, draft);
    },
    []
  );

  // Blinking text cursor (ribbon skin only) - focus is no longer shown via
  // color changes on the caret/rule, so the flashing cursor is the only
  // active-input cue.
  const [cursorBlinkOn, setCursorBlinkOn] = useState(true);
  useEffect(() => {
    if (!skin.inputRibbon || !isFocused) return;
    setCursorBlinkOn(true);
    const id = setInterval(() => setCursorBlinkOn((v) => !v), 500);
    return () => clearInterval(id);
  }, [skin.inputRibbon, isFocused]);

  // Transient status line for clipboard-image sends (auto-clears after 3s).
  const [status, setStatus] = useState<string | null>(null);
  const statusTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showStatus = useCallback((msg: string) => {
    setStatus(msg);
    if (statusTimeout.current) clearTimeout(statusTimeout.current);
    statusTimeout.current = setTimeout(() => setStatus(null), 3000);
  }, []);
  useEffect(
    () => () => {
      if (statusTimeout.current) clearTimeout(statusTimeout.current);
    },
    []
  );

  // Entering edit mode loads the message text; leaving it clears the input.
  // The edit present at mount is a restored draft whose text may differ from
  // the original, so skip it.
  const prevEditingRef = useRef(editingMessage);
  useEffect(() => {
    if (editingMessage === prevEditingRef.current) return;
    prevEditingRef.current = editingMessage;
    setState(
      editingMessage
        ? { value: editingMessage.text, cursor: editingMessage.text.length }
        : { value: "", cursor: 0 }
    );
  }, [editingMessage]);

  // Enter clears the input inside a state updater so fast typing isn't lost;
  // the submit runs after commit because updaters must not dispatch.
  const pendingSubmit = useRef<string | null>(null);
  useEffect(() => {
    const text = pendingSubmit.current;
    if (text === null || !selectedChatId) return;
    pendingSubmit.current = null;
    if (editingMessage && onEdit) {
      if (text !== editingMessage.text) {
        onEdit(text, selectedChatId, editingMessage.id);
      }
      onCancelEdit?.();
      return;
    }
    onSubmit(text, selectedChatId);
    onCancelReply?.();
  });

  // Custom input handler - atomic state updates prevent character flipping
  useInput(
    (input, key) => {
      // Escape leaves the input (handled by App); reply/edit context is kept
      if (key.escape) {
        return;
      }

      // Cancel reply/edit mode (Ctrl+X)
      if (key.ctrl && input === "x") {
        if (editingMessage) onCancelEdit?.();
        else if (replyingToMessage) onCancelReply?.();
        return;
      }

      // Up arrow: enter edit mode when input is empty
      if (key.upArrow && state.value === "" && !editingMessage && !replyingToMessage) {
        onStartEdit?.();
        return;
      }

      // Submit on Enter (sent from the effect above once the input clears)
      if (key.return) {
        setState((s) => {
          if (s.value.trim() && selectedChatId) {
            // Transform any trailing emoticon before submitting
            const { text: transformedText } = transformEmoticons(s.value, s.value.length);
            pendingSubmit.current = transformedText.trim();
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

      // Paste image from clipboard and send it (Ctrl+V)
      if (key.ctrl && input === "v") {
        if (selectedChatId && onSendImage) {
          showStatus("Sending image…");
          onSendImage(selectedChatId).then((result) => {
            showStatus(result.ok ? "✓ Image sent" : result.error ?? "Failed to send image");
          });
        }
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
        setState((s) => {
          const newValue = s.value.slice(0, s.cursor) + input + s.value.slice(s.cursor);
          const newCursor = s.cursor + input.length;

          // Transform emoticon when space is typed
          if (input === " ") {
            const { text, cursorAdjustment } = transformEmoticons(newValue, newCursor);
            return { value: text, cursor: newCursor + cursorAdjustment };
          }

          return { value: newValue, cursor: newCursor };
        });
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

  const caretColor = skin.inputRibbon ? "cyan" : isFocused ? "cyan" : "white";
  const cursorInverse = isFocused && (skin.inputRibbon ? cursorBlinkOn : true);

  const inputRow = (
    <>
      <Text bold color={caretColor}>{skin.inputRibbon ? skin.glyphs.caret : ">"} </Text>
      <Box flexGrow={1}>
        {showPlaceholder ? (
          <Text dimColor>{placeholder}</Text>
        ) : (
          <Text>
            <Text>{beforeCursor}</Text>
            <Text inverse={cursorInverse}>{atCursor}</Text>
            <Text>{afterCursor}</Text>
          </Text>
        )}
      </Box>
      {status && <Text dimColor> {status}</Text>}
    </>
  );

  return (
    <Box flexDirection="column" width="100%">
      {/* Mode indicator */}
      {modeIndicator && (
        <Box paddingX={1}>
          <Text dimColor>{modeIndicator} (^X to cancel)</Text>
        </Box>
      )}
      {skin.inputRibbon ? (
        <>
          {/* Thin full-width rule instead of a bordered box, merging into
              ShortcutsBar's own rule+text below it. */}
          <Box
            width="100%"
            borderStyle="single"
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
            borderColor="gray"
          />
          <Box width="100%" paddingX={1}>
            {inputRow}
          </Box>
        </>
      ) : (
        <Box
          width="100%"
          minHeight={3}
          borderStyle="round"
          borderColor={isFocused ? "cyan" : "blue"}
          paddingX={1}
        >
          {inputRow}
        </Box>
      )}
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
    prev.onSendImage === next.onSendImage &&
    prev.onStartEdit === next.onStartEdit &&
    prev.replyingToMessage === next.replyingToMessage &&
    prev.editingMessage === next.editingMessage
  );
});
