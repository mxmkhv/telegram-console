# Message Layouts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "Classic" and "Bubble" message layout options to Settings, allowing users to switch between the current linear format and a mobile-style conversation layout.

**Architecture:** Extend AppConfig and AppState with a `messageLayout` field. Settings panel provides selection UI with ASCII previews. MessageView branches rendering logic based on layout preference. Config persists to disk.

**Tech Stack:** React, Ink (terminal UI), TypeScript, conf for persistence

---

## Task 1: Add MessageLayout Type and Extend AppConfig

**Files:**
- Modify: `src/types/index.ts:3-13`

**Step 1: Add the MessageLayout type and extend AppConfig**

Add after line 5 (after `AuthMethod`):

```typescript
export type MessageLayout = "classic" | "bubble";
```

Then extend `AppConfig` to include the new field (add after line 12, before the closing brace):

```typescript
  messageLayout: MessageLayout;
```

The full AppConfig should now be:
```typescript
export interface AppConfig {
  apiId: number | string;
  apiHash: string;
  sessionPersistence: SessionMode;
  logLevel: LogLevel;
  authMethod: AuthMethod;
  messageLayout: MessageLayout;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/maxkehayov/Developer/telegram-console && bun run build 2>&1 | head -20`

Expected: Type errors about missing `messageLayout` in config loading (this is expected, we'll fix in Task 2)

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add MessageLayout type to AppConfig"
```

---

## Task 2: Add messageLayout to AppState and Reducer

**Files:**
- Modify: `src/state/reducer.ts:1-77`

**Step 1: Import MessageLayout type**

Change line 1 from:
```typescript
import type { Chat, Message, ConnectionState, FocusedPanel, CurrentView } from "../types";
```
to:
```typescript
import type { Chat, Message, ConnectionState, FocusedPanel, CurrentView, MessageLayout } from "../types";
```

**Step 2: Add messageLayout to AppState interface**

Add after line 29 (after `inlinePreviews`):
```typescript
  messageLayout: MessageLayout;
```

**Step 3: Add the action type**

Add to the AppAction union (after line 56, before the semicolon):
```typescript
  | { type: "SET_MESSAGE_LAYOUT"; payload: MessageLayout }
```

**Step 4: Add default to initialState**

Add after line 76 (after `inlinePreviews: new Map(),`):
```typescript
  messageLayout: "classic",
```

**Step 5: Add reducer case**

Add before the `default:` case (around line 259):
```typescript
    case "SET_MESSAGE_LAYOUT":
      return { ...state, messageLayout: action.payload };
```

**Step 6: Verify TypeScript compiles**

Run: `cd /Users/maxkehayov/Developer/telegram-console && bun run build 2>&1 | head -20`

Expected: Still type errors about config (Task 3 fixes this)

**Step 7: Commit**

```bash
git add src/state/reducer.ts
git commit -m "feat(state): add messageLayout to AppState and reducer"
```

---

## Task 3: Update Config Loading with Default

**Files:**
- Modify: `src/config/index.ts:21-27` and `src/config/index.ts:39-53`

**Step 1: Import MessageLayout type**

Change line 4 from:
```typescript
import type { AppConfig } from "../types";
```
to:
```typescript
import type { AppConfig, MessageLayout } from "../types";
```

**Step 2: Update loadConfig to add default**

Replace the `loadConfig` function (lines 21-27) with:
```typescript
export function loadConfig(customDir?: string): AppConfig | null {
  const path = getConfigPath(customDir);
  if (!existsSync(path)) return null;

  const content = readFileSync(path, "utf-8");
  const config = JSON.parse(content) as Partial<AppConfig>;

  // Provide default for messageLayout if missing (backwards compatibility)
  return {
    ...config,
    messageLayout: config.messageLayout ?? "classic",
  } as AppConfig;
}
```

**Step 3: Update loadConfigWithEnvOverrides**

Replace lines 39-53 with:
```typescript
export function loadConfigWithEnvOverrides(customDir?: string): AppConfig | null {
  const config = loadConfig(customDir);
  if (!config) return null;

  return {
    ...config,
    apiId: process.env.TG_API_ID
      ? (/^\d+$/.test(process.env.TG_API_ID) ? parseInt(process.env.TG_API_ID, 10) : process.env.TG_API_ID)
      : config.apiId,
    apiHash: process.env.TG_API_HASH ?? config.apiHash,
    sessionPersistence: (process.env.TG_SESSION_MODE as AppConfig["sessionPersistence"]) ?? config.sessionPersistence,
    logLevel: (process.env.TG_LOG_LEVEL as AppConfig["logLevel"]) ?? config.logLevel,
    authMethod: (process.env.TG_AUTH_METHOD as AppConfig["authMethod"]) ?? config.authMethod,
    messageLayout: (process.env.TG_MESSAGE_LAYOUT as MessageLayout) ?? config.messageLayout,
  };
}
```

**Step 4: Verify TypeScript compiles clean**

Run: `cd /Users/maxkehayov/Developer/telegram-console && bun run build`

Expected: Build succeeds with no errors

**Step 5: Commit**

```bash
git add src/config/index.ts
git commit -m "feat(config): load/save messageLayout with backwards-compatible default"
```

---

## Task 4: Build SettingsPanel UI

**Files:**
- Modify: `src/components/SettingsPanel.tsx` (full rewrite)

**Step 1: Implement the full SettingsPanel**

Replace the entire file with:

```typescript
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
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <Box flexDirection="column">
            <Text dimColor>[14:32] </Text>
            <Text>Alice: Hello!</Text>
          </Box>
        </Box>
        <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={-1}>
          <Box flexDirection="column">
            <Text dimColor>[14:33] </Text>
            <Text color="cyan">You: </Text>
            <Text>Hi there</Text>
          </Box>
        </Box>
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
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <Box flexDirection="column">
            <Text dimColor>Alice</Text>
            <Text dimColor>Hello!</Text>
            <Text dimColor>14:32</Text>
          </Box>
        </Box>
        <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={-1}>
          <Box flexDirection="column" alignItems="flex-end">
            <Text color="blue">Hi there</Text>
            <Text dimColor>14:33</Text>
          </Box>
        </Box>
      </Box>

      <Text> </Text>
      <Text dimColor>↑↓ Navigate · Enter to select · Esc to go back</Text>
    </Box>
  );
}

export const SettingsPanel = memo(SettingsPanelInner);
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/maxkehayov/Developer/telegram-console && bun run build`

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "feat(settings): add message layout selector with ASCII previews"
```

---

## Task 5: Add Bubble Layout Rendering to MessageView

**Files:**
- Modify: `src/components/MessageView.tsx`

**Step 1: Import MessageLayout type**

Change line 3 from:
```typescript
import type { Message } from "../types";
```
to:
```typescript
import type { Message, MessageLayout } from "../types";
```

**Step 2: Add messageLayout and isGroupChat to props interface**

Update the `MessageViewProps` interface (lines 9-18) to:
```typescript
interface MessageViewProps {
  isFocused: boolean;
  selectedChatTitle: string | null;
  messages: Message[];
  selectedIndex: number;
  isLoadingOlder?: boolean;
  canLoadOlder?: boolean;
  width: number;
  dispatch: Dispatch<AppAction>;
  messageLayout: MessageLayout;
  isGroupChat: boolean;
}
```

**Step 3: Add helper function for bubble line count**

Add after the `getMessageLineCount` function (after line 31):
```typescript
function getBubbleMessageLineCount(msg: Message, isGroupChat: boolean): number {
  const textLines = msg.text ? msg.text.split("\n").length : 0;
  const hasName = isGroupChat && !msg.isOutgoing;
  // name line (if group + not outgoing) + text lines + timestamp line + blank line
  return (hasName ? 1 : 0) + Math.max(1, textLines) + 1 + 1;
}
```

**Step 4: Update function signature to destructure new props**

Change line 33 to include the new props:
```typescript
function MessageViewInner({ isFocused, selectedChatTitle, messages: chatMessages, selectedIndex, isLoadingOlder = false, canLoadOlder = false, width, dispatch, messageLayout, isGroupChat }: MessageViewProps) {
```

**Step 5: Update messageLineCounts calculation**

Replace the `messageLineCounts` useMemo (lines 45-50) with:
```typescript
  // Calculate line count for each message
  const messageLineCounts = useMemo(() => {
    return chatMessages.map((msg, index) => {
      const isSelected = index === selectedIndex && isFocused;
      if (messageLayout === "bubble") {
        return getBubbleMessageLineCount(msg, isGroupChat);
      }
      return getMessageLineCount(msg, isSelected);
    });
  }, [chatMessages, selectedIndex, isFocused, messageLayout, isGroupChat]);
```

**Step 6: Add renderBubbleMessage function**

Add before the `if (!selectedChatTitle)` check (around line 118):
```typescript
  // Render a single message in bubble layout
  const renderBubbleMessage = (msg: Message, isSelected: boolean, actualIndex: number) => {
    const showName = isGroupChat && !msg.isOutgoing;
    const textLines = msg.text ? msg.text.split("\n") : [""];
    const mediaInfo = msg.media ? formatMediaMetadata(msg.media, msg.id) : "";
    const viewHint = isSelected && msg.media ? " [Enter to view]" : "";
    const timestamp = formatTime(msg.timestamp);

    // Calculate padding for right-aligned messages
    const contentWidth = width - 4; // Account for borders and padding

    return (
      <Box key={msg.id} flexDirection="column" marginBottom={1}>
        {/* Sender name (groups only, others only) */}
        {showName && (
          <Text dimColor>{msg.senderName}</Text>
        )}

        {/* Message content */}
        {textLines.map((line, lineIndex) => {
          const isFirstLine = lineIndex === 0;
          const content = isFirstLine && mediaInfo
            ? `${line} ${mediaInfo}${viewHint}`.trim() || `${mediaInfo}${viewHint}`
            : line;

          if (msg.isOutgoing) {
            // Right-aligned, blue
            const padding = Math.max(0, contentWidth - content.length);
            return (
              <Text key={lineIndex} inverse={isSelected}>
                {" ".repeat(padding)}
                <Text color="blue">{content}</Text>
              </Text>
            );
          } else {
            // Left-aligned, dim
            return (
              <Text key={lineIndex} inverse={isSelected} dimColor>
                {content}
              </Text>
            );
          }
        })}

        {/* Timestamp */}
        {msg.isOutgoing ? (
          <Text dimColor>
            {" ".repeat(Math.max(0, contentWidth - timestamp.length))}
            {timestamp}
          </Text>
        ) : (
          <Text dimColor>{timestamp}</Text>
        )}
      </Box>
    );
  };
```

**Step 7: Update the message rendering section**

Replace the message rendering block (the `visibleMessages.map` section, approximately lines 141-174) with:
```typescript
        {messageLayout === "bubble" ? (
          // Bubble layout rendering
          visibleMessages.map((msg, i) => {
            const actualIndex = startIndex + i;
            const isSelected = actualIndex === selectedIndex && isFocused;
            return renderBubbleMessage(msg, isSelected, actualIndex);
          })
        ) : (
          // Classic layout rendering (existing code)
          visibleMessages.map((msg, i) => {
            const actualIndex = startIndex + i;
            const isSelected = actualIndex === selectedIndex && isFocused;
            const senderName = msg.isOutgoing ? "You" : msg.senderName;
            const nbspSenderName = senderName.replace(/ /g, "\u00A0");
            const lines = msg.text.split("\n");
            const mediaInfo = msg.media ? ` ${formatMediaMetadata(msg.media, msg.id)}` : '';
            const viewHint = isSelected && msg.media ? ' [Press enter to view]' : '';

            return (
              <Box key={msg.id} flexDirection="column">
                {lines.map((line, lineIndex) => (
                  <Box key={lineIndex}>
                    <Text wrap="wrap">
                      {lineIndex === 0 ? (
                        <>
                          <Text inverse={isSelected} dimColor={!isSelected}>[{formatTime(msg.timestamp)}]{"\u00A0"}</Text>
                          <Text inverse={isSelected} bold color={msg.isOutgoing ? "cyan" : "white"}>{nbspSenderName}:</Text>
                          <Text inverse={isSelected} dimColor>{mediaInfo}</Text>
                          <Text inverse={isSelected}> {line}</Text>
                          <Text inverse={isSelected} color="yellow">{viewHint}</Text>
                        </>
                      ) : (
                        <Text inverse={isSelected} dimColor={!isSelected}>{"        "}{line}</Text>
                      )}
                    </Text>
                  </Box>
                ))}
              </Box>
            );
          })
        )}
```

**Step 8: Verify TypeScript compiles**

Run: `cd /Users/maxkehayov/Developer/telegram-console && bun run build 2>&1 | head -30`

Expected: Errors about missing props in app.tsx (we'll fix in Task 6)

**Step 9: Commit**

```bash
git add src/components/MessageView.tsx
git commit -m "feat(messageview): add bubble layout rendering with alignment and colors"
```

---

## Task 6: Wire Up Props in app.tsx

**Files:**
- Modify: `src/app.tsx:349-358`

**Step 1: Pass messageLayout and isGroupChat to MessageView**

Find the `<MessageView` component (around line 349) and update it to:
```typescript
            <MessageView
              isFocused={isMessagesFocused && !state.mediaPanel.isOpen}
              selectedChatTitle={selectedChat?.title ?? null}
              messages={currentMessages}
              selectedIndex={messageIndex}
              isLoadingOlder={isLoadingOlder}
              canLoadOlder={canLoadOlder}
              width={messageViewWidth}
              dispatch={dispatch}
              messageLayout={state.messageLayout}
              isGroupChat={selectedChat?.isGroup ?? false}
            />
```

**Step 2: Verify full build succeeds**

Run: `cd /Users/maxkehayov/Developer/telegram-console && bun run build`

Expected: Build succeeds with no errors

**Step 3: Manual test**

Run: `cd /Users/maxkehayov/Developer/telegram-console && bun run dev --mock`

Test:
1. Press `S` to open Settings
2. Use arrow keys to navigate between Classic and Bubble
3. Press Enter to select Bubble
4. Press Esc to return to chat
5. Verify messages display in bubble format (your messages right-aligned in blue, others left-aligned in grey)

**Step 4: Commit**

```bash
git add src/app.tsx
git commit -m "feat(app): pass messageLayout and isGroupChat props to MessageView"
```

---

## Task 7: Final Integration Commit

**Step 1: Verify everything works together**

Run: `cd /Users/maxkehayov/Developer/telegram-console && bun run build && bun run dev --mock`

Test the full flow:
1. App starts with Classic layout (default)
2. Settings shows both options with previews
3. Selecting Bubble changes the message display
4. Restart app - setting persists

**Step 2: Create integration commit**

```bash
git add -A
git commit -m "feat: complete message layouts feature

Add user-selectable message layout option with two modes:
- Classic: linear format with timestamps and sender inline
- Bubble: mobile-style with alignment (yours right/blue, others left/grey)

Settings panel includes ASCII previews of each layout option.
Preference persists to config file."
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add MessageLayout type | types/index.ts |
| 2 | Add to AppState and reducer | state/reducer.ts |
| 3 | Update config loading | config/index.ts |
| 4 | Build SettingsPanel UI | SettingsPanel.tsx |
| 5 | Add bubble rendering | MessageView.tsx |
| 6 | Wire up props | app.tsx |
| 7 | Integration test | - |

Total: ~150-180 lines of new/modified code across 6 files.
