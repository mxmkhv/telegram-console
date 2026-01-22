import React, { memo } from "react";
import { Box, Text } from "ink";
import type { ConnectionState, FocusedPanel } from "../types";

interface StatusBarProps {
  connectionState: ConnectionState;
  focusedPanel: FocusedPanel;
}

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

function StatusBarInner({ connectionState, focusedPanel }: StatusBarProps) {
  const getHints = () => {
    switch (focusedPanel) {
      case "header":
        return "[←→: Select] [Enter: Activate] [Tab: Next]";
      case "chatList":
        return "[↑↓: Navigate] [Enter: Open] [Tab: Next] [Esc: Back]";
      case "messages":
        return "[←: Chats] [Enter: Type] [Tab: Next] [Esc: Back]";
      case "input":
        return "[Enter: Send] [Tab: Next] [Esc: Back to Chats]";
      default:
        return "";
    }
  };

  return (
    <Box borderStyle="round" paddingX={1} justifyContent="space-between">
      <Text>
        [<Text color={getStatusColor(connectionState)}>{getStatusText(connectionState)}</Text>]
        {" "}
        <Text bold color="cyan">{focusedPanel.toUpperCase()}</Text>
      </Text>
      <Text dimColor>{getHints()}</Text>
    </Box>
  );
}

export const StatusBar = memo(StatusBarInner);
