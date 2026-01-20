# Logout & Welcome UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a header bar with Settings/Logout buttons, implement logout with user choice, and create welcome screens for new/returning users.

**Architecture:** New HeaderBar component at top of MainApp, modal LogoutPrompt overlay, two welcome screen components shown post-auth. State extended with `currentView` and `showLogoutPrompt`. Tab navigation cycle updated to include header.

**Tech Stack:** React, Ink (terminal UI), TypeScript

---

## Task 1: Extend Types for Header and View State

**Files:**
- Modify: `src/types/index.ts:14`

**Step 1: Update FocusedPanel type**

In `src/types/index.ts`, change line 14 from:
```typescript
export type FocusedPanel = "chatList" | "messages" | "input";
```

To:
```typescript
export type FocusedPanel = "header" | "chatList" | "messages" | "input";
```

**Step 2: Add new types for view state**

Add after line 14 in `src/types/index.ts`:
```typescript
export type CurrentView = "chat" | "settings";
export type LogoutMode = "session" | "full";
```

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors (existing code still compiles)

**Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add header panel and view state types"
```

---

## Task 2: Extend Reducer with View State

**Files:**
- Modify: `src/state/reducer.ts`

**Step 1: Add new state fields to AppState**

In `src/state/reducer.ts`, update the `AppState` interface (after line 10):
```typescript
export interface AppState {
  connectionState: ConnectionState;
  chats: Chat[];
  selectedChatId: string | null;
  messages: Record<string, Message[]>;
  focusedPanel: FocusedPanel;
  loadingOlderMessages: Record<string, boolean>;
  hasMoreMessages: Record<string, boolean>;
  currentView: CurrentView;
  showLogoutPrompt: boolean;
  headerSelectedButton: "settings" | "logout";
}
```

**Step 2: Update imports**

Change line 1 to:
```typescript
import type { Chat, Message, ConnectionState, FocusedPanel, CurrentView } from "../types";
```

**Step 3: Add new action types**

Add to `AppAction` type union (after line 23):
```typescript
  | { type: "SET_CURRENT_VIEW"; payload: CurrentView }
  | { type: "SET_SHOW_LOGOUT_PROMPT"; payload: boolean }
  | { type: "SET_HEADER_SELECTED_BUTTON"; payload: "settings" | "logout" }
  | { type: "RESET_STATE" };
```

**Step 4: Update initialState**

Update `initialState` (around line 25):
```typescript
export const initialState: AppState = {
  connectionState: "disconnected",
  chats: [],
  selectedChatId: null,
  messages: {},
  focusedPanel: "chatList",
  loadingOlderMessages: {},
  hasMoreMessages: {},
  currentView: "chat",
  showLogoutPrompt: false,
  headerSelectedButton: "settings",
};
```

**Step 5: Add reducer cases**

Add before the `default` case in `appReducer`:
```typescript
    case "SET_CURRENT_VIEW":
      return { ...state, currentView: action.payload };

    case "SET_SHOW_LOGOUT_PROMPT":
      return { ...state, showLogoutPrompt: action.payload };

    case "SET_HEADER_SELECTED_BUTTON":
      return { ...state, headerSelectedButton: action.payload };

    case "RESET_STATE":
      return { ...initialState };
```

**Step 6: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add src/state/reducer.ts
git commit -m "feat(reducer): add view state and logout prompt actions"
```

---

## Task 3: Add Config Delete Functions

**Files:**
- Modify: `src/config/index.ts`

**Step 1: Add deleteSession function**

Add at end of `src/config/index.ts`:
```typescript
export function getSessionPath(customDir?: string): string {
  return join(getConfigDir(customDir), "session");
}

export function deleteSession(customDir?: string): void {
  const path = getSessionPath(customDir);
  if (existsSync(path)) {
    const { unlinkSync } = require("fs");
    unlinkSync(path);
  }
}

export function deleteConfig(customDir?: string): void {
  const path = getConfigPath(customDir);
  if (existsSync(path)) {
    const { unlinkSync } = require("fs");
    unlinkSync(path);
  }
}

export function deleteAllData(customDir?: string): void {
  deleteSession(customDir);
  deleteConfig(customDir);
}
```

**Step 2: Update imports at top of file**

Change line 1 to:
```typescript
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
```

**Step 3: Simplify delete functions to use imported unlinkSync**

Update the delete functions:
```typescript
export function deleteSession(customDir?: string): void {
  const path = getSessionPath(customDir);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export function deleteConfig(customDir?: string): void {
  const path = getConfigPath(customDir);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}
```

**Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/config/index.ts
git commit -m "feat(config): add session and config delete functions"
```

---

## Task 4: Create WelcomeNew Component

**Files:**
- Create: `src/components/WelcomeNew.tsx`

**Step 1: Create the component file**

Create `src/components/WelcomeNew.tsx`:
```typescript
import React from "react";
import { Box, Text, useInput } from "ink";

interface WelcomeNewProps {
  userName: string;
  onContinue: () => void;
}

export function WelcomeNew({ userName, onContinue }: WelcomeNewProps) {
  useInput(() => {
    onContinue();
  });

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      borderStyle="single"
      borderColor="cyan"
      paddingX={4}
      paddingY={2}
    >
      <Text bold color="cyan">
        Welcome, {userName}!
      </Text>
      <Text> </Text>
      <Text dimColor>Press any key to continue</Text>
    </Box>
  );
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/WelcomeNew.tsx
git commit -m "feat(components): add WelcomeNew component for first-time users"
```

---

## Task 5: Create WelcomeBack Component

**Files:**
- Create: `src/components/WelcomeBack.tsx`

**Step 1: Create the component file**

Create `src/components/WelcomeBack.tsx`:
```typescript
import React from "react";
import { Box, Text, useInput } from "ink";

interface WelcomeBackProps {
  userName: string;
  onContinue: () => void;
}

export function WelcomeBack({ userName, onContinue }: WelcomeBackProps) {
  useInput(() => {
    onContinue();
  });

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      borderStyle="single"
      borderColor="cyan"
      paddingX={4}
      paddingY={2}
    >
      <Text bold color="cyan">
        Welcome back, {userName}!
      </Text>
      <Text> </Text>
      <Text dimColor>Press any key to continue</Text>
    </Box>
  );
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/WelcomeBack.tsx
git commit -m "feat(components): add WelcomeBack component for returning users"
```

---

## Task 6: Create HeaderBar Component

**Files:**
- Create: `src/components/HeaderBar.tsx`

**Step 1: Create the component file**

Create `src/components/HeaderBar.tsx`:
```typescript
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
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/HeaderBar.tsx
git commit -m "feat(components): add HeaderBar with Settings and Logout buttons"
```

---

## Task 7: Create SettingsPanel Component

**Files:**
- Create: `src/components/SettingsPanel.tsx`

**Step 1: Create the component file**

Create `src/components/SettingsPanel.tsx`:
```typescript
import React, { memo } from "react";
import { Box, Text } from "ink";

function SettingsPanelInner() {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
      flexGrow={1}
    >
      <Text bold color="cyan">
        Settings
      </Text>
      <Text> </Text>
      <Text>Settings coming soon.</Text>
      <Text> </Text>
      <Text dimColor>Press Esc to go back</Text>
    </Box>
  );
}

export const SettingsPanel = memo(SettingsPanelInner);
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "feat(components): add placeholder SettingsPanel"
```

---

## Task 8: Create LogoutPrompt Component

**Files:**
- Create: `src/components/LogoutPrompt.tsx`

**Step 1: Create the component file**

Create `src/components/LogoutPrompt.tsx`:
```typescript
import React, { useState, memo } from "react";
import { Box, Text, useInput } from "ink";
import type { LogoutMode } from "../types";

interface LogoutPromptProps {
  onConfirm: (mode: LogoutMode) => void;
  onCancel: () => void;
}

function LogoutPromptInner({ onConfirm, onCancel }: LogoutPromptProps) {
  const [selected, setSelected] = useState<LogoutMode>("session");

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.leftArrow) {
      setSelected("session");
      return;
    }

    if (key.rightArrow) {
      setSelected("full");
      return;
    }

    if (key.return) {
      onConfirm(selected);
      return;
    }
  });

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      borderStyle="single"
      borderColor="cyan"
      paddingX={4}
      paddingY={1}
    >
      <Text bold color="cyan">
        Log out
      </Text>
      <Text> </Text>
      <Text>What would you like to clear?</Text>
      <Text> </Text>
      <Box>
        <Text
          bold={selected === "session"}
          color={selected === "session" ? "cyan" : undefined}
          dimColor={selected !== "session"}
        >
          [Session only]
        </Text>
        <Text>  </Text>
        <Text
          bold={selected === "full"}
          color={selected === "full" ? "cyan" : undefined}
          dimColor={selected !== "full"}
        >
          [Full reset]
        </Text>
      </Box>
      <Text> </Text>
      <Text dimColor>Press Esc to cancel</Text>
    </Box>
  );
}

export const LogoutPrompt = memo(LogoutPromptInner);
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/LogoutPrompt.tsx
git commit -m "feat(components): add LogoutPrompt modal with session/full options"
```

---

## Task 9: Update StatusBar for Header Panel

**Files:**
- Modify: `src/components/StatusBar.tsx`

**Step 1: Add header case to getHints function**

In `src/components/StatusBar.tsx`, update the `getHints` function (lines 33-44):
```typescript
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
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/StatusBar.tsx
git commit -m "feat(statusbar): add keyboard hints for header panel"
```

---

## Task 10: Integrate Everything into App.tsx - Part 1 (Welcome Screens)

**Files:**
- Modify: `src/app.tsx`

**Step 1: Add imports at top of file**

Update imports (after line 11):
```typescript
import { WelcomeNew } from "./components/WelcomeNew";
import { WelcomeBack } from "./components/WelcomeBack";
import { hasConfig, loadConfigWithEnvOverrides, saveConfig, deleteSession, deleteAllData, getSessionPath } from "./config";
```

**Step 2: Add welcome state to App component**

In the `App` component, after line 258 (`const [isSetupComplete, setIsSetupComplete] = useState(false);`), add:
```typescript
  const [showWelcome, setShowWelcome] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [userName, setUserName] = useState("");
```

**Step 3: Track returning user status**

Update the first `useEffect` (lines 260-269) to track if session existed:
```typescript
  useEffect(() => {
    if (hasConfig()) {
      const loadedConfig = loadConfigWithEnvOverrides();
      if (loadedConfig && loadedConfig.apiId && loadedConfig.apiHash) {
        setConfig(loadedConfig);
        // Check if session exists (returning user)
        const { existsSync } = require("fs");
        const sessionExists = existsSync(getSessionPath());
        setIsReturningUser(sessionExists);
        setIsSetupComplete(true);
      }
    }
  }, []);
```

**Step 4: Add welcome trigger after service creation**

After the second `useEffect` that creates telegramService, add a new effect:
```typescript
  // Fetch user name and show welcome after service is ready
  useEffect(() => {
    if (telegramService && !showWelcome && userName === "") {
      telegramService.connect().then(async () => {
        try {
          // Get user info - we need to access the underlying client
          // For now, use a placeholder; this will be enhanced
          setUserName("User");
          setShowWelcome(true);
        } catch {
          setShowWelcome(true);
        }
      });
    }
  }, [telegramService, showWelcome, userName]);
```

**Step 5: Handle welcome dismiss**

Add callback after handleSetupComplete:
```typescript
  const handleWelcomeDismiss = useCallback(() => {
    setShowWelcome(false);
  }, []);
```

**Step 6: Render welcome screens**

Update the render logic (before line 339 `return`) to handle welcome:
```typescript
  if (!isSetupComplete) {
    return (
      <Setup
        onComplete={handleSetupComplete}
        preferredAuthMethod="qr"
      />
    );
  }

  if (!telegramService) {
    return null;
  }

  if (showWelcome) {
    return isReturningUser ? (
      <WelcomeBack userName={userName} onContinue={handleWelcomeDismiss} />
    ) : (
      <WelcomeNew userName={userName} onContinue={handleWelcomeDismiss} />
    );
  }
```

**Step 7: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add src/app.tsx
git commit -m "feat(app): add welcome screens for new and returning users"
```

---

## Task 11: Integrate Everything into App.tsx - Part 2 (Header and Logout)

**Files:**
- Modify: `src/app.tsx`

**Step 1: Add remaining imports**

Add to imports:
```typescript
import { HeaderBar } from "./components/HeaderBar";
import { SettingsPanel } from "./components/SettingsPanel";
import { LogoutPrompt } from "./components/LogoutPrompt";
import type { LogoutMode } from "./types";
```

**Step 2: Add logout handler to App component**

Add after `handleWelcomeDismiss`:
```typescript
  const handleLogout = useCallback((mode: LogoutMode) => {
    if (telegramService) {
      telegramService.disconnect();
    }
    if (mode === "session") {
      deleteSession();
      // Return to QR auth - keep config, clear setup state
      setTelegramService(null);
      setShowWelcome(false);
      setUserName("");
      setIsReturningUser(false);
      // Re-trigger setup but skip to auth step
      setIsSetupComplete(false);
    } else {
      deleteAllData();
      // Full reset - clear everything
      setConfig(null);
      setTelegramService(null);
      setShowWelcome(false);
      setUserName("");
      setIsReturningUser(false);
      setIsSetupComplete(false);
    }
  }, [telegramService]);
```

**Step 3: Pass logout handler to MainApp**

Update the MainApp render:
```typescript
  return (
    <AppProvider telegramService={telegramService}>
      <MainApp telegramService={telegramService} onLogout={handleLogout} />
    </AppProvider>
  );
```

**Step 4: Update MainApp props interface**

Update the `MainAppProps` interface:
```typescript
interface MainAppProps {
  telegramService: TelegramService;
  onLogout: (mode: LogoutMode) => void;
}
```

**Step 5: Update MainApp function signature**

Update the MainApp function:
```typescript
function MainApp({ telegramService, onLogout }: MainAppProps) {
```

**Step 6: Add header button handlers in MainApp**

Add after the existing state declarations (around line 22):
```typescript
  const handleHeaderSelectButton = useCallback(
    (button: "settings" | "logout") => {
      dispatch({ type: "SET_HEADER_SELECTED_BUTTON", payload: button });
    },
    [dispatch]
  );

  const handleHeaderActivate = useCallback(
    (button: "settings" | "logout") => {
      if (button === "settings") {
        dispatch({ type: "SET_CURRENT_VIEW", payload: "settings" });
      } else {
        dispatch({ type: "SET_SHOW_LOGOUT_PROMPT", payload: true });
      }
    },
    [dispatch]
  );

  const handleLogoutConfirm = useCallback(
    (mode: LogoutMode) => {
      dispatch({ type: "SET_SHOW_LOGOUT_PROMPT", payload: false });
      onLogout(mode);
    },
    [dispatch, onLogout]
  );

  const handleLogoutCancel = useCallback(() => {
    dispatch({ type: "SET_SHOW_LOGOUT_PROMPT", payload: false });
  }, [dispatch]);
```

**Step 7: Update Tab navigation to include header**

Update the Tab handling in the first `useInput` (around line 88):
```typescript
      if (key.tab) {
        if (state.focusedPanel === "header") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
        } else if (state.focusedPanel === "chatList") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "messages" });
        } else if (state.focusedPanel === "messages") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "input" });
        } else if (state.focusedPanel === "input") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "header" });
        }
        return;
      }
```

**Step 8: Add header keyboard handling**

Add header-specific handling in the first `useInput`, after the Tab handling:
```typescript
      // Header panel navigation
      if (state.focusedPanel === "header") {
        if (key.leftArrow) {
          dispatch({ type: "SET_HEADER_SELECTED_BUTTON", payload: "settings" });
        } else if (key.rightArrow) {
          dispatch({ type: "SET_HEADER_SELECTED_BUTTON", payload: "logout" });
        } else if (key.return) {
          handleHeaderActivate(state.headerSelectedButton);
        }
        return;
      }
```

**Step 9: Add global shortcuts (S and L)**

Add before panel-specific navigation, after Escape handling:
```typescript
      // Global shortcuts (when not in input)
      if (input === "s" || input === "S") {
        dispatch({ type: "SET_CURRENT_VIEW", payload: "settings" });
        return;
      }
      if (input === "l" || input === "L") {
        dispatch({ type: "SET_SHOW_LOGOUT_PROMPT", payload: true });
        return;
      }
```

**Step 10: Handle Escape in settings view**

Update the Escape handling:
```typescript
      if (key.escape) {
        if (state.currentView === "settings") {
          dispatch({ type: "SET_CURRENT_VIEW", payload: "chat" });
        } else {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
        }
        return;
      }
```

**Step 11: Add computed focus variables**

Add after existing focus boolean declarations (around line 214):
```typescript
  const isHeaderFocused = state.focusedPanel === "header";
```

**Step 12: Update the MainApp render**

Replace the entire return statement of MainApp:
```typescript
  return (
    <Box flexDirection="column" height="100%">
      <HeaderBar
        isFocused={isHeaderFocused}
        selectedButton={state.headerSelectedButton}
        onSelectButton={handleHeaderSelectButton}
        onActivate={handleHeaderActivate}
      />
      {state.showLogoutPrompt ? (
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <LogoutPrompt onConfirm={handleLogoutConfirm} onCancel={handleLogoutCancel} />
        </Box>
      ) : state.currentView === "settings" ? (
        <SettingsPanel />
      ) : (
        <>
          <Box flexGrow={1}>
            <ChatList
              chats={state.chats}
              selectedChatId={state.selectedChatId}
              onSelectChat={handleSelectChat}
              selectedIndex={chatIndex}
              isFocused={isChatListFocused}
            />
            <MessageView
              isFocused={isMessagesFocused}
              selectedChatTitle={selectedChat?.title ?? null}
              messages={currentMessages}
              selectedIndex={messageIndex}
              isLoadingOlder={isLoadingOlder}
              canLoadOlder={canLoadOlder}
            />
          </Box>
          <InputBar
            isFocused={isInputFocused}
            onSubmit={handleSendMessage}
            selectedChatId={state.selectedChatId}
          />
        </>
      )}
      <StatusBar
        connectionState={state.connectionState}
        focusedPanel={state.focusedPanel}
      />
    </Box>
  );
```

**Step 13: Add LogoutMode import to types import**

Update the types import at top of file:
```typescript
import type { AppConfig, TelegramService, LogoutMode } from "./types";
```

**Step 14: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 15: Commit**

```bash
git add src/app.tsx
git commit -m "feat(app): integrate header bar, settings panel, and logout flow"
```

---

## Task 12: Manual Testing

**Step 1: Start the app**

Run: `npm run dev` or `bun run dev`

**Step 2: Test header navigation**

- Press Tab to cycle to header
- Press ← and → to switch between Settings and Logout
- Verify cyan highlighting follows selection

**Step 3: Test Settings**

- Press Enter on Settings (or press S from any non-input panel)
- Verify "Settings coming soon" screen appears
- Press Esc to return to chat view

**Step 4: Test Logout prompt**

- Press Enter on Logout (or press L from any non-input panel)
- Verify logout modal appears with two options
- Press ← and → to switch between Session only and Full reset
- Press Esc to cancel

**Step 5: Test Session-only logout**

- Trigger logout, select "Session only", press Enter
- Verify app returns to QR auth screen (not Welcome with API credentials)

**Step 6: Test Full reset logout**

- After re-authenticating, trigger logout with "Full reset"
- Verify app returns to Welcome screen (requires API credentials again)

**Step 7: Test welcome screens**

- Do a full reset, complete setup
- Verify "Welcome, User!" appears after authentication
- Press any key, verify main app loads
- Quit and restart app
- Verify "Welcome back, User!" appears
- Press any key, verify main app loads

**Step 8: Commit if all tests pass**

```bash
git add -A
git commit -m "feat: complete logout and welcome UI implementation"
```

---

## Summary of Files Changed

**Created:**
- `src/components/WelcomeNew.tsx`
- `src/components/WelcomeBack.tsx`
- `src/components/HeaderBar.tsx`
- `src/components/SettingsPanel.tsx`
- `src/components/LogoutPrompt.tsx`

**Modified:**
- `src/types/index.ts`
- `src/state/reducer.ts`
- `src/config/index.ts`
- `src/components/StatusBar.tsx`
- `src/app.tsx`
