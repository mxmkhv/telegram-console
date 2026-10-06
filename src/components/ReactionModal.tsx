import { memo, useState } from "react";
import { useInput } from "ink";
import { Box, Text } from "./ui";

export const MODAL_EMOJIS = [
  "👍", "❤️", "😂", "😮", "😢", "🎉",
  "🔥", "👏", "🤔", "😅", "🥰", "😍",
  "🙏", "💯", "🤣", "😊", "😭", "😱",
  "🤯", "🥳", "😏", "🤩", "💀", "👀",
  "✨", "💔", "🙄", "😤", "🤝", "👎",
] as const;

const COLS = 6;
const ROWS = 5;

// Border (2) + title and its gap (2) + the gap and [Cancel] below the grid (2)
const FULL_HEIGHT = ROWS + 6;
// Border (2) + padding (2) + four columns per emoji
const FULL_WIDTH = COLS * 4 + 4;

interface ReactionModalProps {
  onSelect: (emoji: string) => void;
  onCancel: () => void;
  isActive?: boolean;
  /** Space available; a short one drops the title and [Cancel] and scrolls the grid */
  width?: number;
  height?: number;
}

function ReactionModalInner({ onSelect, onCancel, isActive = true, width = Infinity, height = Infinity }: ReactionModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [onCancelRow, setOnCancelRow] = useState(false);
  const compact = height < FULL_HEIGHT;

  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
        return;
      }

      if (key.return) {
        if (onCancelRow) {
          onCancel();
        } else {
          onSelect(MODAL_EMOJIS[selectedIndex]!);
        }
        return;
      }

      if (key.leftArrow && !onCancelRow) {
        setSelectedIndex((i) => (i % COLS === 0 ? i : i - 1));
      } else if (key.rightArrow && !onCancelRow) {
        setSelectedIndex((i) => ((i + 1) % COLS === 0 ? i : i + 1));
      } else if (key.upArrow) {
        if (onCancelRow) {
          setOnCancelRow(false);
        } else if (selectedIndex >= COLS) {
          setSelectedIndex((i) => i - COLS);
        }
      } else if (key.downArrow) {
        if (!onCancelRow && selectedIndex >= COLS * (ROWS - 1)) {
          // Esc cancels when there's no room for the [Cancel] row
          if (!compact) setOnCancelRow(true);
        } else if (!onCancelRow) {
          setSelectedIndex((i) => i + COLS);
        }
      }
    },
    { isActive }
  );

  const rows: string[][] = [];
  for (let i = 0; i < ROWS; i++) {
    rows.push(MODAL_EMOJIS.slice(i * COLS, (i + 1) * COLS) as unknown as string[]);
  }
  // Grid rows that fit, scrolled to keep the selection's row in view
  const shownRows = compact ? Math.max(1, Math.min(ROWS, height - 2)) : ROWS;
  const selectedRow = Math.floor(selectedIndex / COLS);
  const firstRow = Math.max(0, Math.min(selectedRow - Math.floor(shownRows / 2), ROWS - shownRows));

  return (
    <Box
      flexDirection="column"
      flexShrink={0}
      borderStyle="round"
      borderColor="cyan"
      paddingX={width >= FULL_WIDTH ? 1 : 0}
    >
      {!compact && (
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="cyan">React</Text>
        </Box>
      )}
      {rows.slice(firstRow, firstRow + shownRows).map((row, i) => {
        const rowIndex = firstRow + i;
        return (
        <Box key={rowIndex} justifyContent="center">
          {row.map((emoji, colIndex) => {
            const index = rowIndex * COLS + colIndex;
            const isSelected = !onCancelRow && index === selectedIndex;
            return (
              <Text key={emoji} inverse={isSelected}>
                {" "}{emoji}{" "}
              </Text>
            );
          })}
        </Box>
        );
      })}
      {!compact && (
        <Box justifyContent="center" marginTop={1}>
          <Text inverse={onCancelRow} dimColor={!onCancelRow}>
            [Cancel]
          </Text>
        </Box>
      )}
    </Box>
  );
}

export const ReactionModal = memo(ReactionModalInner);
