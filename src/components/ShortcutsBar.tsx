import { memo } from "react";
import { Box, Text, useSkin } from "./ui";

const HINTS = "^K go to chat · Tab cycle · ^V send image · m minimal · h hide · c colors · s settings · l logout";
const RIBBON_ICON = "⏵⏵";

function ShortcutsBarInner() {
  const skin = useSkin();

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
          <Text dimColor wrap="truncate">
            {HINTS}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box paddingX={1}>
      <Text dimColor wrap="truncate">
        {HINTS}
      </Text>
    </Box>
  );
}

export const ShortcutsBar = memo(ShortcutsBarInner);
