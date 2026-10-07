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
      {/* One row always: on narrow screens the title gives way to the buttons */}
      <Text bold color="cyan" wrap="truncate">
        telegram-console
      </Text>
      <Box flexShrink={0} marginLeft={1}>
        <Text {...settingsStyle}>[Settings]</Text>
        <Text> </Text>
        <Text {...logoutStyle}>[Logout]</Text>
      </Box>
    </Box>
  );
}

export const HeaderBar = memo(HeaderBarInner);
