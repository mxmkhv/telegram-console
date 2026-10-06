import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useInput } from "ink";
import stringWidth from "string-width";
import { Box, Text, useSkin } from "./ui";
import type { Message, ImageSendResult, ChatDraft } from "../types";
import { transformEmoticons } from "../utils/emoticonMap";
import { findCursorRow, moveCursorToRow, nextBoundary, previousBoundary, wrapInput } from "../utils/inputLayout";

/** A long draft scrolls inside the input past this many rows */
export const MAX_INPUT_ROWS = 4;

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
  /** Columns the bar spans */
  width: number;
  /** Text rows the layout reserved; defaults to what the text needs */
  rows?: number;
  /** Text rows the text needs, up to MAX_INPUT_ROWS */
  onRowsChange?: (rows: number) => void;
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
  width,
  rows,
  onRowsChange,
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

  // The caret, and the transient status on the right, share the first row
  const chromeWidth = (skin.inputRibbon ? 2 : 4) + 2 + (status ? 1 + stringWidth(status) : 0);
  // One column stays free for the cursor at the end of a row
  const wrapWidth = Math.max(1, width - chromeWidth - 1);

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

      // Up/down move between rows; past the first or last row, to the start or end
      if (key.upArrow || key.downArrow) {
        setState((s) => {
          const inputRows = wrapInput(s.value, wrapWidth);
          const target = findCursorRow(inputRows, s.cursor) + (key.upArrow ? -1 : 1);
          if (target < 0) return { ...s, cursor: 0 };
          if (target >= inputRows.length) return { ...s, cursor: s.value.length };
          return { ...s, cursor: moveCursorToRow(s.value, inputRows, s.cursor, target) };
        });
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
            const start = previousBoundary(s.value, s.cursor);
            return { value: s.value.slice(0, start) + s.value.slice(s.cursor), cursor: start };
          }
          return s;
        });
        return;
      }

      // Cursor movement - left
      if (key.leftArrow) {
        setState((s) => ({ ...s, cursor: previousBoundary(s.value, s.cursor) }));
        return;
      }

      // Cursor movement - right
      if (key.rightArrow) {
        setState((s) => ({ ...s, cursor: nextBoundary(s.value, s.cursor) }));
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

      // Insert character at cursor position. Alt+Enter arrives as "\r" and
      // Ctrl+J as "\n": both start a new line, as do newlines in a paste.
      if (input && !key.ctrl && !key.meta) {
        // Tabs measure as zero columns but the terminal expands them, and
        // other control characters (keys that arrived glued together) garble the row
        const text = input
          .replace(/\r\n?/g, "\n")
          .replace(/\t/g, "    ")
          // eslint-disable-next-line no-control-regex
          .replace(/[\x00-\x09\x0b-\x1f\x7f-\x9f]/g, "");
        if (!text) return;
        setState((s) => {
          const newValue = s.value.slice(0, s.cursor) + text + s.value.slice(s.cursor);
          const newCursor = s.cursor + text.length;

          // Transform emoticon when space is typed
          if (text === " ") {
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

  const safeCursor = Math.min(cursor, value.length);
  const inputRows = useMemo(() => wrapInput(value, wrapWidth), [value, wrapWidth]);
  const cursorRow = findCursorRow(inputRows, safeCursor);

  // The layout reserves the rows, so report what the text needs
  const neededRows = Math.min(MAX_INPUT_ROWS, inputRows.length);
  useEffect(() => {
    onRowsChange?.(neededRows);
  }, [neededRows, onRowsChange]);
  const shownRows = rows ?? neededRows;

  // Scroll only as far as it takes to keep the cursor's row in view
  const scrollRef = useRef(0);
  let scroll = scrollRef.current;
  if (cursorRow < scroll) scroll = cursorRow;
  if (cursorRow >= scroll + shownRows) scroll = cursorRow - shownRows + 1;
  scroll = Math.max(0, Math.min(scroll, inputRows.length - shownRows));
  scrollRef.current = scroll;

  // Determine mode indicator
  const modeIndicator = editingMessage
    ? "✎ Editing..."
    : replyingToMessage
      ? `↩ Replying to ${replyingToMessage.senderName}...`
      : null;

  const caretColor = skin.inputRibbon ? "cyan" : isFocused ? "cyan" : "white";
  const cursorInverse = isFocused && (skin.inputRibbon ? cursorBlinkOn : true);

  const renderRow = (index: number) => {
    const row = inputRows[index];
    if (!row) return " ";
    if (index !== cursorRow) return value.slice(row.start, row.end);
    // At the end of a line the cursor sits on a blank cell after the text
    const atEnd = safeCursor >= row.end;
    const cursorEnd = atEnd ? safeCursor : nextBoundary(value, safeCursor);
    return (
      <>
        {value.slice(row.start, safeCursor)}
        <Text inverse={cursorInverse}>{atEnd ? " " : value.slice(safeCursor, cursorEnd)}</Text>
        {value.slice(cursorEnd, row.end)}
      </>
    );
  };

  const inputRow = (
    <>
      <Text bold color={caretColor}>{skin.inputRibbon ? skin.glyphs.caret : ">"} </Text>
      <Box flexGrow={1} flexDirection="column">
        {showPlaceholder ? (
          <Text dimColor wrap="truncate">{placeholder}</Text>
        ) : (
          Array.from({ length: shownRows }, (_, i) => (
            <Text key={i} wrap="truncate">
              {renderRow(scroll + i)}
            </Text>
          ))
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
          <Text dimColor wrap="truncate">{modeIndicator} (^X to cancel)</Text>
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
    prev.editingMessage === next.editingMessage &&
    prev.width === next.width &&
    prev.rows === next.rows &&
    prev.onRowsChange === next.onRowsChange
  );
});
