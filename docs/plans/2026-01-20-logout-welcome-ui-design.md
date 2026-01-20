# Logout Mechanism & Welcome UI Design

## Overview

Add a header bar with Settings/Logout buttons, implement logout flow with user choice, and create welcome screens for first-time and returning users.

## Components

### New Files

| File | Purpose |
|------|---------|
| `src/components/HeaderBar.tsx` | Top bar with app title + [Settings] [Logout] buttons |
| `src/components/WelcomeNew.tsx` | First-time user welcome after auth |
| `src/components/WelcomeBack.tsx` | Returning user welcome on app launch |
| `src/components/SettingsPanel.tsx` | Placeholder settings view |
| `src/components/LogoutPrompt.tsx` | Modal for logout options |

### Modified Files

| File | Changes |
|------|---------|
| `src/app.tsx` | Welcome screen logic, isReturningUser tracking |
| `src/state/reducer.ts` | Add "header" to focusedPanel, add view state for settings |
| `src/components/StatusBar.tsx` | Update keyboard hints to reflect header navigation |

## Header Bar

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  telegram-console                        [Settings] [Logout] │
└─────────────────────────────────────────────────────────────┘
```

### Behavior

- App title on left, buttons on right
- Cyan border when focused (matches existing focus style)
- Selected button: cyan/bold, unselected: dim
- Keyboard when focused: `←`/`→` switch buttons, `Enter` activates
- Global shortcuts (when not in InputBar): `S` for Settings, `L` for Logout

### Navigation

Tab cycle order:
```
header → chatList → messages → input → header...
```

## Logout Flow

### Trigger

- `Enter` on [Logout] button
- `L` shortcut (when not typing in InputBar)

### Prompt Modal

```
┌──────────────────────────────────────┐
│           Log out                    │
│                                      │
│  What would you like to clear?       │
│                                      │
│  [Session only]  [Full reset]        │
│                                      │
│          Press Esc to cancel         │
└──────────────────────────────────────┘
```

### Options

| Option | Action |
|--------|--------|
| Session only | Delete session file, keep API credentials, return to QR auth |
| Full reset | Delete session + config.json, return to Welcome setup |

### Keyboard

- `←`/`→` switch between options
- `Enter` confirm selection
- `Esc` cancel and return to app

### Post-Logout Actions

1. Disconnect Telegram client
2. Clear in-memory state (chats, messages)
3. Set `isSetupComplete = false`
4. Route to Setup flow (QR auth or full Welcome based on choice)

## Welcome Screens

### When Shown

After successful authentication, before MainApp loads.

### WelcomeNew (First-time User)

Props: `userName: string`, `onContinue: () => void`

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              Welcome, {userName}!                           │
│                                                             │
│              Press any key to continue                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### WelcomeBack (Returning User)

Props: `userName: string`, `onContinue: () => void`

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              Welcome back, {userName}!                      │
│                                                             │
│              Press any key to continue                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Behavior

- Centered on screen, cyan border
- User name from `client.getMe()`
- Any keypress dismisses and loads MainApp
- `isReturningUser` determined by session file existence at startup

## Settings Panel (Placeholder)

### Trigger

- `Enter` on [Settings] button
- `S` shortcut (when not typing in InputBar)

### Layout

```
┌─ Settings ──────────────────────────────────────────────────┐
│                                                             │
│  Settings coming soon.                                      │
│                                                             │
│  Press Esc to go back                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Behavior

- Replaces chat list + message view area (not an overlay)
- Header bar remains visible
- `Esc` returns to chat view
- Chat state preserved in memory

## State Changes

### reducer.ts

```typescript
// Update FocusedPanel type
type FocusedPanel = "header" | "chatList" | "messages" | "input";

// Add view state
interface AppState {
  // ... existing fields
  currentView: "chat" | "settings";
  showLogoutPrompt: boolean;
}
```

### app.tsx

```typescript
// Track welcome state
const [showWelcome, setShowWelcome] = useState(false);
const [isReturningUser, setIsReturningUser] = useState(false);
const [userName, setUserName] = useState("");

// After auth success, fetch user info and show welcome
// isReturningUser = session file existed before auth
```

## File Paths

Config: `~/.config/telegram-console-client/config.json`
Session: `~/.config/telegram-console-client/session`
