# Message Layouts Feature Design

**Date:** 2026-01-22
**Status:** Ready for implementation

## Overview

Add a user-selectable message layout option to the Settings page. Users can choose between "Classic" (current linear layout) and "Bubble" (mobile-style conversation layout).

## Motivation

- **Aesthetics** - More visually appealing mobile-like experience in terminal
- **Readability** - Clear visual distinction between your messages and others
- **Feature parity** - Working toward a full-featured Telegram client experience

## Layout Comparison

### Classic Layout (current)

```
┌─ Messages ─────────────────────────────────────┐
│ [14:32] Alice: Hey, are you coming tonight?    │
│ [14:33] You: Yeah, I'll be there around 8      │
│ [14:35] Alice: Perfect! See you then           │
│ [14:36] You: 👍                                 │
└────────────────────────────────────────────────┘
```

### Bubble Layout (new)

```
┌─ Messages ─────────────────────────────────────┐
│ Alice:                                         │
│ Hey, are you coming tonight?                   │
│ 14:32                                          │
│                                                │
│                    Yeah, I'll be there around 8│
│                                          14:33 │
│                                                │
│ Perfect! See you then                          │
│ 14:35                                          │
│                                                │
│                                              👍│
│                                          14:36 │
└────────────────────────────────────────────────┘
```

## Design Decisions

| Aspect | Decision |
|--------|----------|
| Visual style | Terminal-native (box-drawing chars, ANSI colors) |
| Bubble effect | Indent + color text (minimalist, no borders) |
| Your messages | Right-aligned, blue text |
| Others' messages | Left-aligned, grey/dim text |
| Timestamps | Below message, dimmed (may iterate to "on selection only") |
| Sender names | Others only, group chats only, above message |
| Settings UI | Toggle with ASCII preview mockups |
| Option names | "Classic" / "Bubble" |

## Technical Design

### New Types

```typescript
// types/index.ts
type MessageLayout = "classic" | "bubble";

interface AppConfig {
  // ...existing fields
  messageLayout: MessageLayout;
}
```

### State Management

```typescript
// state/reducer.ts
interface AppState {
  // ...existing fields
  messageLayout: MessageLayout;
}

// New action
{ type: "SET_MESSAGE_LAYOUT"; payload: MessageLayout }
```

### Data Flow

1. On app start, load `messageLayout` from config (default: `"classic"`)
2. Store in `AppState` so components can access it
3. When user changes in Settings, dispatch `SET_MESSAGE_LAYOUT`
4. Persist to config file via `saveConfig()`
5. `MessageView` receives layout as prop, renders accordingly

### MessageView Rendering

```typescript
// Branch based on layout:
if (messageLayout === "classic") {
  return renderClassicMessage(msg, isSelected, isFocused);
} else {
  return renderBubbleMessage(msg, isSelected, isFocused, isGroupChat);
}
```

**renderBubbleMessage logic:**
1. Check `msg.isOutgoing` for alignment
2. Calculate left-padding for right-aligned messages
3. Build lines:
   - Line 1 (if group + not outgoing): sender name
   - Line 2+: message text with color
   - Final line: timestamp, dimmed
4. Selection uses `inverse` style (same as current)

### Settings Panel UI

```
┌─ Settings ─────────────────────────────────────┐
│                                                │
│  Message Layout                                │
│                                                │
│  ▸ Classic                                     │
│    ┌────────────────────────┐                  │
│    │ [14:32] Alice: Hello   │                  │
│    │ [14:33] You: Hi there  │                  │
│    └────────────────────────┘                  │
│                                                │
│    Bubble                                      │
│    ┌────────────────────────┐                  │
│    │ Alice:                 │                  │
│    │ Hello                  │                  │
│    │ 14:32                  │                  │
│    │              Hi there  │                  │
│    │                 14:33  │                  │
│    └────────────────────────┘                  │
│                                                │
│  Press Enter to select · Esc to go back        │
└────────────────────────────────────────────────┘
```

**Behavior:**
- Arrow keys move selection
- `▸` marker shows current selection
- Enter confirms and saves
- Esc cancels and returns to chat
- Cyan highlight on focused option

## Files to Modify

| File | Change | ~Lines |
|------|--------|--------|
| `src/types/index.ts` | Add `MessageLayout` type, extend `AppConfig` | 5 |
| `src/state/reducer.ts` | Add state field + action handler | 15 |
| `src/config/index.ts` | Load/save with default `"classic"` | 5 |
| `src/components/MessageView.tsx` | Add `renderBubbleMessage()` function | 60-80 |
| `src/components/SettingsPanel.tsx` | Build layout selector UI | 80-100 |
| `src/app.tsx` | Pass props to MessageView | 5 |

**Total:** ~170-200 lines across 6 existing files. No new files needed.

## Edge Cases

- **Multi-line messages:** All lines inherit same alignment/color, timestamp after last line
- **Messages with media:** Keep inline badge `[📷 Photo: 320x240]`, inherits message styling
- **Media-only messages:** Show badge as "text", timestamp below
- **Long messages:** Wrap within available width, right-aligned messages left-pad each line
- **Selection:** `inverse` style applies to all message lines (name + text + timestamp)
- **Group detection:** Derive from Chat type or pass as prop from app.tsx

## Future Considerations

- Timestamp display setting: "always" vs "on selection only"
- Additional layout options if needed
- Per-chat layout override (probably YAGNI)
