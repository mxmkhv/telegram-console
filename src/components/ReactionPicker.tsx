import { memo } from "react";
import { useInput } from "ink";
import stringWidth from "string-width";
import { Box, Text } from "./ui";

export const QUICK_EMOJIS = ["👍", "❤️", "🤣", "😮", "😢", "🔥"] as const;

interface ReactionPickerProps {
  emojis: readonly string[];
  selectedIndex: number;
  onSelect: (emoji: string) => void;
  onOpenModal: () => void;
  onCancel: () => void;
  isActive?: boolean;
  /** Columns available; a narrower picker scrolls to keep the selection in view */
  width?: number;
}

const MORE_LABEL = " [...] ";

/** The [start, end) items to show: all if they fit, else a window around the selection */
export function getPickerWindow(itemWidths: number[], selectedIndex: number, width: number): [number, number] {
  const total = itemWidths.reduce((sum, w) => sum + w, 0);
  if (total <= width) return [0, itemWidths.length];
  // Room for the ‹ › that mark hidden items
  const room = width - 2;
  let start = selectedIndex;
  let end = selectedIndex + 1;
  let used = itemWidths[selectedIndex]!;
  for (;;) {
    if (end < itemWidths.length && used + itemWidths[end]! <= room) used += itemWidths[end++]!;
    else if (start > 0 && used + itemWidths[start - 1]! <= room) used += itemWidths[--start]!;
    else return [start, end];
  }
}

function ReactionPickerInner({
  emojis,
  selectedIndex,
  onSelect,
  onOpenModal,
  onCancel,
  isActive = true,
  width = Infinity,
}: ReactionPickerProps) {
  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
      } else if (key.return) {
        if (selectedIndex === emojis.length) {
          onOpenModal();
        } else {
          onSelect(emojis[selectedIndex]!);
        }
      }
    },
    { isActive }
  );

  // The last item opens the full grid
  const items = [...emojis.map((emoji) => ` ${emoji} `), MORE_LABEL];
  const [start, end] = getPickerWindow(items.map((item) => stringWidth(item)), selectedIndex, width);
  const clipped = end - start < items.length;

  // One row, always: the message it replaces was counted as at least one
  return (
    <Box height={1} overflow="hidden">
      {clipped && <Text dimColor>{start > 0 ? "‹" : " "}</Text>}
      {items.slice(start, end).map((item, i) => (
        <Text key={item} inverse={start + i === selectedIndex}>
          {item}
        </Text>
      ))}
      {clipped && <Text dimColor>{end < items.length ? "›" : " "}</Text>}
    </Box>
  );
}

export const ReactionPicker = memo(ReactionPickerInner);
