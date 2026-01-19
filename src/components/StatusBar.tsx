import React from "react";
import { Box, Text } from "ink";
import { useAppState } from "../state/context";
import type { ConnectionState } from "../types";

function getStatusColor(state: ConnectionState): string {
  switch (state) {
    case "connected":
      return "green";
    case "connecting":
      return "yellow";
    case "disconnected":
      return "red";
  }
}

function getStatusText(state: ConnectionState): string {
  switch (state) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting...";
    case "disconnected":
      return "Disconnected";
  }
}

export function StatusBar() {
  const { connectionState } = useAppState();

  return (
    <Box borderStyle="single" paddingX={1}>
      <Text>
        [Status: <Text color={getStatusColor(connectionState)}>{getStatusText(connectionState)}</Text>]
      </Text>
      <Text> </Text>
      <Text dimColor>[↑↓: Navigate] [Enter: Select] [Tab: Input] [Ctrl+C: Exit]</Text>
    </Box>
  );
}
