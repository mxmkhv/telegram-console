import React, { memo, useState, useCallback } from "react";
import { useInput, Box as InkBox, Text as InkText } from "ink";
import { Box, Text, useSkin } from "./ui";
import { useApp } from "../state/context";
import type { MessageLayout } from "../types";
import { loadConfig, saveConfig } from "../config";
import { SKIN_NAMES, getSkin } from "../config/skins";

const LAYOUT_OPTIONS: MessageLayout[] = ["classic", "bubble"];

const TABS = [
  { key: "layout", label: "Message Layout" },
  { key: "skin", label: "Skin" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function SettingsPanelInner() {
  const { state, dispatch } = useApp();
  const skin = useSkin();
  const [activeTab, setActiveTab] = useState<TabKey>("layout");
  const [layoutIndex, setLayoutIndex] = useState(
    Math.max(0, LAYOUT_OPTIONS.indexOf(state.messageLayout)),
  );
  const [skinIndex, setSkinIndex] = useState(
    Math.max(0, SKIN_NAMES.indexOf(state.skin)),
  );

  const handleSelect = useCallback(() => {
    if (activeTab === "layout") {
      const newLayout = LAYOUT_OPTIONS[layoutIndex]!;
      dispatch({ type: "SET_MESSAGE_LAYOUT", payload: newLayout });
      const config = loadConfig();
      if (config) {
        saveConfig({ ...config, messageLayout: newLayout });
      }
    } else {
      const newSkin = SKIN_NAMES[skinIndex]!;
      dispatch({ type: "SET_SKIN", payload: newSkin });
      const config = loadConfig();
      if (config) {
        saveConfig({ ...config, skin: newSkin });
      }
    }
  }, [activeTab, layoutIndex, skinIndex, dispatch]);

  useInput((input, key) => {
    if (key.escape) {
      dispatch({ type: "SET_CURRENT_VIEW", payload: "chat" });
    } else if (key.leftArrow || key.rightArrow || key.tab) {
      setActiveTab((t) => (t === "layout" ? "skin" : "layout"));
    } else if (key.upArrow) {
      if (activeTab === "layout") setLayoutIndex((i) => Math.max(0, i - 1));
      else setSkinIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      if (activeTab === "layout") {
        setLayoutIndex((i) => Math.min(LAYOUT_OPTIONS.length - 1, i + 1));
      } else {
        setSkinIndex((i) => Math.min(SKIN_NAMES.length - 1, i + 1));
      }
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
      paddingY={skin.spacing.panelPaddingY}
      flexGrow={1}
    >
      <Text bold color="cyan">
        Settings
      </Text>
      <Text> </Text>

      {/* Tab bar */}
      <Box flexDirection="row">
        {TABS.map((tab, i) => {
          const isActiveTab = activeTab === tab.key;
          return (
            <React.Fragment key={tab.key}>
              {i > 0 && <Text>  </Text>}
              <Text bold={isActiveTab} color={isActiveTab ? "cyan" : undefined} dimColor={!isActiveTab}>
                {isActiveTab ? `[ ${tab.label} ]` : `  ${tab.label}  `}
              </Text>
            </React.Fragment>
          );
        })}
      </Box>
      <Text> </Text>

      {activeTab === "layout" ? (
        <>
          {/* Classic Option */}
          <Box flexDirection="row">
            <Text color={layoutIndex === 0 ? "cyan" : undefined}>
              {layoutIndex === 0 ? `${skin.glyphs.caret} ` : "  "}
            </Text>
            <Text bold color={layoutIndex === 0 ? "cyan" : undefined}>
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
            <Text color={layoutIndex === 1 ? "cyan" : undefined}>
              {layoutIndex === 1 ? `${skin.glyphs.caret} ` : "  "}
            </Text>
            <Text bold color={layoutIndex === 1 ? "cyan" : undefined}>
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
        </>
      ) : (
        <>
          {SKIN_NAMES.map((name, i) => {
            const isSelected = skinIndex === i;
            const previewSkin = getSkin(name);
            return (
              <React.Fragment key={name}>
                <Box flexDirection="row" marginTop={i === 0 ? 0 : 1}>
                  <Text color={isSelected ? "cyan" : undefined}>
                    {isSelected ? `${skin.glyphs.caret} ` : "  "}
                  </Text>
                  <Text bold color={isSelected ? "cyan" : undefined}>
                    {previewSkin.label}
                  </Text>
                  {state.skin === name && <Text dimColor> (current)</Text>}
                </Box>
                {/* Uses raw Ink primitives (not the themed Box/Text) so the swatch always
                    shows this skin's true accent color, regardless of which skin is active. */}
                <InkBox marginLeft={4} marginY={1} borderStyle="round" borderColor={previewSkin.colorMap.cyan ?? "cyan"} paddingX={1}>
                  <InkText bold color={previewSkin.colorMap.cyan ?? "cyan"}>
                    {previewSkin.glyphs.caret} Preview
                  </InkText>
                </InkBox>
              </React.Fragment>
            );
          })}
        </>
      )}

      <Text> </Text>
      <Text dimColor>←→ Switch tab · ↑↓ Navigate · Enter to select · Esc to go back</Text>
    </Box>
  );
}

export const SettingsPanel = memo(SettingsPanelInner);
