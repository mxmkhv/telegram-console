import { memo } from "react";
import { useInput } from "ink";
import { Box, Text } from "./ui";

export const QUICK_EMOJIS = ["👍", "❤️", "🤣", "😮", "😢", "🔥"] as const;

interface ReactionPickerProps {
  emojis: readonly string[];
  selectedIndex: number;
  onSelect: (emoji: string) => void;
  onOpenModal: () => void;
  onCancel: () => void;
  isActive?: boolean;
}

function ReactionPickerInner({
  emojis,
  selectedIndex,
  onSelect,
  onOpenModal,
  onCancel,
  isActive = true,
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

  // One row, always: the message it replaces was counted as at least one
  return (
    <Box height={1} overflow="hidden">
      {emojis.map((emoji, index) => (
        <Text key={emoji} inverse={index === selectedIndex}>
          {" "}{emoji}{" "}
        </Text>
      ))}
      <Text inverse={selectedIndex === emojis.length}> [...] </Text>
    </Box>
  );
}

export const ReactionPicker = memo(ReactionPickerInner);
