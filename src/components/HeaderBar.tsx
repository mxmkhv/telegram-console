import React, { memo } from "react";
import { Box, Text, useSkin } from "./ui";

interface HeaderBarProps {
  isFocused: boolean;
  selectedButton: "settings" | "logout";
}

function HeaderBarInner({ isFocused, selectedButton }: HeaderBarProps) {
  const skin = useSkin();
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
      {...(skin.panelDividers
        ? {
            borderStyle: "single" as const,
            borderTop: false,
            borderLeft: false,
            borderRight: false,
            borderBottom: true,
            borderColor: "gray",
          }
        : { borderStyle: "round" as const, borderColor: isFocused ? "cyan" : "blue" })}
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
