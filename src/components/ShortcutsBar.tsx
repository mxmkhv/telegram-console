import { memo } from "react";
import { Box, Text, useSkin } from "./ui";
import { fitHints, getHints } from "../keymap";

const RIBBON_ICON = "⏵⏵";
const GLOBAL_HINTS = getHints("global");

interface ShortcutsBarProps {
  width: number;
}

function ShortcutsBarInner({ width }: ShortcutsBarProps) {
  const skin = useSkin();
  // paddingX (2), plus the ribbon icon and its space
  const hints = fitHints(GLOBAL_HINTS, width - 2 - (skin.inputRibbon ? RIBBON_ICON.length + 1 : 0));

  if (skin.inputRibbon) {
    // Thin rule + plain hint text directly under the input row, so the two
    // read as one merged control (Claude Code CLI's look) instead of a
    // bordered box followed by a separate dim-text line.
    return (
      <Box flexDirection="column" width="100%">
        <Box
          width="100%"
          borderStyle="single"
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderColor="gray"
        />
        <Box paddingX={1}>
          <Text color="cyan">{RIBBON_ICON} </Text>
          <Text dimColor>{hints}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box paddingX={1}>
      <Text dimColor>{hints}</Text>
    </Box>
  );
}

export const ShortcutsBar = memo(ShortcutsBarInner);
