import { memo } from "react";
import { Box, Text, useSkin } from "./ui";
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
  const skin = useSkin();
  const getHints = () => {
    switch (focusedPanel) {
      case "header":
        return "[←→: Select] [Enter: Activate] [Tab: Next]";
      case "chatList":
        return "[↑↓: Navigate] [Enter: Open] [Tab: Next] [Esc: Back]";
      case "messages":
        return "[R: React] [Shift+R: Reply] [Enter: Message] [←: Chats] [Esc: Back]";
      case "input":
        return "[Enter: Send] [↑: Edit] [Esc: Back]";
      default:
        return "";
    }
  };

  return (
    <Box
      {...(skin.panelDividers
        ? {
            borderStyle: "single" as const,
            borderBottom: false,
            borderLeft: false,
            borderRight: false,
            borderTop: true,
            borderColor: "gray",
          }
        : { borderStyle: "round" as const })}
      paddingX={1}
      justifyContent="space-between"
    >
      <Text wrap="truncate">
        [
        <Text color={getStatusColor(connectionState)}>
          {getStatusText(connectionState)}
        </Text>
        ]{" "}
        <Text bold color="cyan">
          {focusedPanel.toUpperCase()}
        </Text>
      </Text>
      <Text dimColor wrap="truncate">{getHints()}</Text>
    </Box>
  );
}

export const StatusBar = memo(StatusBarInner);
