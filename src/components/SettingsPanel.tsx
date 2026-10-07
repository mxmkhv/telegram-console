import React, { memo, useState, useCallback } from "react";
import { useInput, Box as InkBox, Text as InkText } from "ink";
import { Box, Text, useSkin } from "./ui";
import { useApp } from "../state/context";
import type { MessageLayout, NotificationMode } from "../types";
import { updateConfig } from "../config";
import { SKIN_NAMES, getSkin } from "../config/skins";
import { detectDesktopNotify } from "../services/terminalNotify";

const LAYOUT_OPTIONS: MessageLayout[] = ["classic", "bubble"];

const NOTIFICATION_OPTIONS: { mode: NotificationMode; label: string; detail: string }[] = [
  { mode: "all", label: "Bell and desktop notification", detail: "Who wrote, and the start of the message" },
  { mode: "bell", label: "Bell only", detail: "No message text leaves the terminal" },
  { mode: "off", label: "Off", detail: "The window title still counts unread" },
];

const EMOTICON_OPTIONS: { convert: boolean; label: string; detail: string }[] = [
  { convert: true, label: "Convert to emoji", detail: ":) becomes 🙂 as you type, except inside `code`" },
  { convert: false, label: "Keep as typed", detail: ":) stays :)" },
];

const TABS = [
  { key: "layout", label: "Layout" },
  { key: "skin", label: "Skin" },
  { key: "notifications", label: "Notifications" },
  { key: "typing", label: "Typing" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

interface Option {
  label: string;
  detail: string;
}

/** Choices with a line of detail under each */
function OptionList<T extends Option>({
  options,
  selectedIndex,
  isCurrent,
}: {
  options: T[];
  selectedIndex: number;
  isCurrent: (option: T) => boolean;
}) {
  const skin = useSkin();
  return options.map((option, i) => {
    const isSelected = selectedIndex === i;
    return (
      <React.Fragment key={option.label}>
        <Box flexDirection="row" marginTop={i === 0 ? 0 : 1}>
          <Text color={isSelected ? "cyan" : undefined}>{isSelected ? `${skin.glyphs.caret} ` : "  "}</Text>
          <Text bold color={isSelected ? "cyan" : undefined}>
            {option.label}
          </Text>
          {isCurrent(option) && <Text dimColor> (current)</Text>}
        </Box>
        <Box marginLeft={4}>
          <Text dimColor>{option.detail}</Text>
        </Box>
      </React.Fragment>
    );
  });
}

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
  const [notifyIndex, setNotifyIndex] = useState(
    Math.max(0, NOTIFICATION_OPTIONS.findIndex((o) => o.mode === state.notifications)),
  );
  const [emoticonIndex, setEmoticonIndex] = useState(
    Math.max(0, EMOTICON_OPTIONS.findIndex((o) => o.convert === state.convertEmoticons)),
  );
  const optionCount = {
    layout: LAYOUT_OPTIONS.length,
    skin: SKIN_NAMES.length,
    notifications: NOTIFICATION_OPTIONS.length,
    typing: EMOTICON_OPTIONS.length,
  };
  const setIndex = { layout: setLayoutIndex, skin: setSkinIndex, notifications: setNotifyIndex, typing: setEmoticonIndex }[
    activeTab
  ];

  const handleSelect = useCallback(() => {
    if (activeTab === "layout") {
      const newLayout = LAYOUT_OPTIONS[layoutIndex]!;
      dispatch({ type: "SET_MESSAGE_LAYOUT", payload: newLayout });
      updateConfig({ messageLayout: newLayout });
    } else if (activeTab === "skin") {
      const newSkin = SKIN_NAMES[skinIndex]!;
      dispatch({ type: "SET_SKIN", payload: newSkin });
      updateConfig({ skin: newSkin });
    } else if (activeTab === "notifications") {
      const { mode } = NOTIFICATION_OPTIONS[notifyIndex]!;
      dispatch({ type: "SET_NOTIFICATIONS", payload: mode });
      updateConfig({ notifications: mode });
    } else {
      const { convert } = EMOTICON_OPTIONS[emoticonIndex]!;
      dispatch({ type: "SET_CONVERT_EMOTICONS", payload: convert });
      updateConfig({ convertEmoticons: convert });
    }
  }, [activeTab, layoutIndex, skinIndex, notifyIndex, emoticonIndex, dispatch]);

  useInput((input, key) => {
    if (key.escape) {
      dispatch({ type: "SET_CURRENT_VIEW", payload: "chat" });
    } else if (key.leftArrow || key.rightArrow || key.tab) {
      const step = key.leftArrow || (key.tab && key.shift) ? -1 : 1;
      setActiveTab((t) => TABS[(TABS.findIndex((tab) => tab.key === t) + step + TABS.length) % TABS.length]!.key);
    } else if (key.upArrow) {
      setIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setIndex((i) => Math.min(optionCount[activeTab] - 1, i + 1));
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

      {/* Tab bar: on narrow screens, whole tabs wrap to a second row */}
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        {TABS.map((tab) => {
          const isActiveTab = activeTab === tab.key;
          return (
            <Text key={tab.key} bold={isActiveTab} color={isActiveTab ? "cyan" : undefined} dimColor={!isActiveTab}>
              {isActiveTab ? `[ ${tab.label} ]` : `  ${tab.label}  `}
            </Text>
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
      ) : activeTab === "typing" ? (
        <OptionList
          options={EMOTICON_OPTIONS}
          selectedIndex={emoticonIndex}
          isCurrent={(option) => option.convert === state.convertEmoticons}
        />
      ) : activeTab === "notifications" ? (
        <>
          <OptionList
            options={NOTIFICATION_OPTIONS}
            selectedIndex={notifyIndex}
            isCurrent={(option) => option.mode === state.notifications}
          />
          <Text> </Text>
          <Text dimColor>Muted chats and the open chat never alert.</Text>
          {!detectDesktopNotify(process.env) && (
            <Text dimColor>No desktop notifications in this terminal.</Text>
          )}
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
