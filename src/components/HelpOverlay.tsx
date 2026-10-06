import { memo, useMemo, useState } from "react";
import { useInput } from "ink";
import { Box, Text } from "./ui";
import { KEYMAP } from "../keymap";

type Row = { kind: "title"; text: string } | { kind: "binding"; keys: string; action: string } | { kind: "blank" };

interface HelpOverlayProps {
  onClose: () => void;
  width: number;
  height: number;
}

const TWO_COLUMN_MIN_WIDTH = 96;
// Border (2) + title (1) + footer (1)
const CHROME_ROWS = 4;
const KEYS_WIDTH = Math.max(...Object.values(KEYMAP).flatMap((s) => s.bindings.map((b) => b.keys.join(" ").length))) + 2;

const SECTION_ROWS: Row[][] = Object.values(KEYMAP).map(({ title, bindings }) => [
  { kind: "title", text: title },
  ...bindings.map((b): Row => ({ kind: "binding", keys: b.keys.join(" "), action: b.action })),
]);

function stack(sections: Row[][]): Row[] {
  return sections.flatMap((section, i) => (i > 0 ? [{ kind: "blank" } as const, ...section] : section));
}

// Whole sections, in order: the left column takes sections until it's half full
function splitColumns(sections: Row[][]): [Row[], Row[]] {
  const half = stack(sections).length / 2;
  let height = 0;
  const overflowAt = sections.findIndex((section) => {
    height += section.length + 1;
    return height - section.length / 2 > half;
  });
  const splitAt = overflowAt < 1 ? Math.min(1, sections.length) : overflowAt;
  return [stack(sections.slice(0, splitAt)), stack(sections.slice(splitAt))];
}

function HelpRow({ row, width }: { row: Row | undefined; width: number }) {
  return (
    <Box width={width} height={1} flexShrink={0}>
      {row?.kind === "title" && (
        <Text bold color="cyan" wrap="truncate">
          {row.text}
        </Text>
      )}
      {row?.kind === "binding" && (
        <>
          <Box width={Math.min(KEYS_WIDTH, width)} flexShrink={0}>
            <Text color="yellow" wrap="truncate">
              {row.keys}
            </Text>
          </Box>
          <Text wrap="truncate">{row.action}</Text>
        </>
      )}
    </Box>
  );
}

function HelpOverlayInner({ onClose, width, height }: HelpOverlayProps) {
  const [scroll, setScroll] = useState(0);
  const twoColumns = width >= TWO_COLUMN_MIN_WIDTH;
  const innerWidth = width - 4;
  const columnWidth = twoColumns ? Math.floor((innerWidth - 2) / 2) : innerWidth;

  // Each line holds one row, or a left/right pair
  const lines = useMemo((): [Row, Row | undefined][] => {
    if (!twoColumns) return stack(SECTION_ROWS).map((row) => [row, undefined]);
    const [left, right] = splitColumns(SECTION_ROWS);
    return Array.from({ length: Math.max(left.length, right.length) }, (_, i) => [
      left[i] ?? { kind: "blank" },
      right[i],
    ]);
  }, [twoColumns]);

  const bodyRows = Math.max(1, height - CHROME_ROWS);
  const maxScroll = Math.max(0, lines.length - bodyRows);
  const offset = Math.min(scroll, maxScroll);
  const visible = lines.slice(offset, offset + bodyRows);

  useInput((input, key) => {
    if (key.escape || key.return || input === "?" || input === "q") {
      onClose();
    } else if (key.upArrow || input === "k") {
      setScroll(Math.max(0, offset - 1));
    } else if (key.downArrow || input === "j") {
      setScroll(Math.min(maxScroll, offset + 1));
    } else if (key.pageUp) {
      setScroll(Math.max(0, offset - bodyRows));
    } else if (key.pageDown || input === " ") {
      setScroll(Math.min(maxScroll, offset + bodyRows));
    }
  });

  const position = maxScroll > 0 ? `${offset + visible.length}/${lines.length} · ↑↓ scroll · ` : "";

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width}>
      <Box justifyContent="space-between">
        <Text bold color="cyan" wrap="truncate">
          Keyboard shortcuts
        </Text>
        <Text dimColor wrap="truncate">
          ^ = Ctrl
        </Text>
      </Box>
      {visible.map(([left, right], i) => (
        <Box key={offset + i} height={1}>
          <HelpRow row={left} width={columnWidth} />
          {twoColumns && (
            <>
              <Box width={2} flexShrink={0} />
              <HelpRow row={right} width={columnWidth} />
            </>
          )}
        </Box>
      ))}
      <Text dimColor wrap="truncate">
        {position}Esc close
      </Text>
    </Box>
  );
}

export const HelpOverlay = memo(HelpOverlayInner);
