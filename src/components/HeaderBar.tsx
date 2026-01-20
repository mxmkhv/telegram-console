import React, { memo } from "react";
import { Box, Text } from "ink";

interface HeaderBarProps {
  isFocused: boolean;
  selectedButton: "settings" | "logout";
  onSelectButton: (button: "settings" | "logout") => void;
  onActivate: (button: "settings" | "logout") => void;
}

function HeaderBarInner({
  isFocused,
  selectedButton,
  onSelectButton,
  onActivate,
}: HeaderBarProps) {
  const settingsStyle = {
    bold: isFocused && selectedButton === "settings",
    color: isFocused && selectedButton === "settings" ? "cyan" : undefined,
    dimColor: !isFocused || selectedButton !== "settings",
  };

  const logoutStyle = {
    bold: isFocused && selectedButton === "logout",
    color: isFocused && selectedButton === "logout" ? "cyan" : undefined,
    dimColor: !isFocused || selectedButton !== "logout",
  };

  return (
    <Box
      borderStyle="single"
      borderColor={isFocused ? "cyan" : undefined}
      paddingX={1}
      justifyContent="space-between"
    >
      <Text bold color="cyan">
        telegram-console
      </Text>
      <Box>
        <Text {...settingsStyle}>[Settings]</Text>
        <Text> </Text>
        <Text {...logoutStyle}>[Logout]</Text>
      </Box>
    </Box>
  );
}

export const HeaderBar = memo(HeaderBarInner);
