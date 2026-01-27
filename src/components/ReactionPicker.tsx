import { memo } from "react";
import { Box, Text, useInput } from "ink";

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

  return (
    <Box>
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
