import React, { memo, useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { useApp } from "../state/context";
import type { MessageLayout } from "../types";
import { loadConfig, saveConfig } from "../config";

const LAYOUT_OPTIONS: MessageLayout[] = ["classic", "bubble"];

function SettingsPanelInner() {
  const { state, dispatch } = useApp();
  const [selectedIndex, setSelectedIndex] = useState(
    LAYOUT_OPTIONS.indexOf(state.messageLayout)
  );

  const handleSelect = useCallback(() => {
    const newLayout = LAYOUT_OPTIONS[selectedIndex]!;
    dispatch({ type: "SET_MESSAGE_LAYOUT", payload: newLayout });

    // Persist to config
    const config = loadConfig();
    if (config) {
      saveConfig({ ...config, messageLayout: newLayout });
    }
  }, [selectedIndex, dispatch]);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(LAYOUT_OPTIONS.length - 1, i + 1));
    } else if (key.return) {
      handleSelect();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      flexGrow={1}
    >
      <Text bold color="cyan">
        Settings
      </Text>
      <Text> </Text>
      <Text bold>Message Layout</Text>
      <Text> </Text>

      {/* Classic Option */}
      <Box flexDirection="row">
        <Text color={selectedIndex === 0 ? "cyan" : undefined}>
          {selectedIndex === 0 ? "▸ " : "  "}
        </Text>
        <Text bold color={selectedIndex === 0 ? "cyan" : undefined}>
          Classic
        </Text>
        {state.messageLayout === "classic" && (
          <Text dimColor> (current)</Text>
        )}
      </Box>
      <Box flexDirection="column" marginLeft={4} marginY={1}>
        <Text><Text dimColor>[14:32] </Text><Text color="green">Alice:</Text> Hello!</Text>
        <Text><Text dimColor>[14:33] </Text><Text color="blue">You:</Text> Hi there</Text>
      </Box>

      {/* Bubble Option */}
      <Box flexDirection="row" marginTop={1}>
        <Text color={selectedIndex === 1 ? "cyan" : undefined}>
          {selectedIndex === 1 ? "▸ " : "  "}
        </Text>
        <Text bold color={selectedIndex === 1 ? "cyan" : undefined}>
          Bubble
        </Text>
        {state.messageLayout === "bubble" && (
          <Text dimColor> (current)</Text>
        )}
      </Box>
      <Box flexDirection="column" marginLeft={4} marginY={1}>
        <Text><Text color="green">Alice</Text></Text>
        <Text>Hello! <Text dimColor>[14:32]</Text></Text>
        <Text>                    <Text color="blue">Hi there</Text> <Text dimColor>[14:33]</Text></Text>
      </Box>

      <Text> </Text>
      <Text dimColor>↑↓ Navigate · Enter to select · Esc to go back</Text>
    </Box>
  );
}

export const SettingsPanel = memo(SettingsPanelInner);
