import { memo } from "react";
import { Box, Text, useSkin } from "./ui";
import type { ConnectionState, FocusedPanel } from "../types";
import { PANEL_LABELS, fitHints, getPanelHints } from "../keymap";

interface StatusBarProps {
  connectionState: ConnectionState;
  focusedPanel: FocusedPanel;
  width: number;
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

function StatusBarInner({ connectionState, focusedPanel, width }: StatusBarProps) {
  const skin = useSkin();
  const label = PANEL_LABELS[focusedPanel];
  // Round border (2) or bare rule (0), plus paddingX (2)
  const chrome = (skin.panelDividers ? 0 : 2) + 2;
  const leftWidth = `[${getStatusText(connectionState)}] ${label}`.length;
  const hints = fitHints(getPanelHints(focusedPanel), width - chrome - leftWidth - 2);

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
      // Keeps its rows when what's above is too tall
      flexShrink={0}
    >
      <Text wrap="truncate">
        [
        <Text color={getStatusColor(connectionState)}>
          {getStatusText(connectionState)}
        </Text>
        ]{" "}
        <Text bold color="cyan">
          {label}
        </Text>
      </Text>
      {hints && <Text dimColor>{hints}</Text>}
    </Box>
  );
}

export const StatusBar = memo(StatusBarInner);
