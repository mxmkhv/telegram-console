# New Message Flash Notification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add visual flash notifications when new messages arrive - flashing chat rows for unselected chats, flashing messages for selected chats.

**Architecture:** Local component state with a reusable `useFlash` hook handles timing. A central config object controls all flash behavior. Components subscribe to `onNewMessage` callback from TelegramService.

**Tech Stack:** React hooks, Ink terminal UI, TypeScript

---

## Revision 2 - Updated Requirements

### Summary of Changes

Based on user feedback, the following changes are needed:

1. **Remove separate "↓ new" indicator row** - it clutters vertical space
2. **Flash the "↓ X more" count instead** - when new messages arrive while scrolled up:
   - Increment the count (e.g., 11 → 12)
   - Flash the number portion
3. **Selected chat unread tracking**:
   - When scrolled up in selected chat, increment `unreadCount` for new messages
   - This makes the cyan dot (●) appear in ChatList for the selected chat
   - Clear unread count immediately when user scrolls to bottom
4. **Keep existing ChatList indicator** - the cyan dot already works, just ensure it updates

### Behavioral Changes

| Scenario | Current | New |
|----------|---------|-----|
| New msg in selected chat (scrolled up) | Shows "↓ new" row | Flash "↓ X more", increment count, increment unreadCount |
| New msg in selected chat (at bottom) | Single flash on message | Keep same |
| Scroll to bottom of selected chat | - | Clear unreadCount immediately |
| ChatList shows selected chat with unread | No indicator | Cyan dot appears |

### Files to Modify

1. **`src/components/MessageView.tsx`**:
   - Remove `newIndicatorVisible` state and "↓ new" row
   - Flash the existing `showScrollDown` text when new messages arrive
   - Track count of messages below viewport (already exists)

2. **`src/state/reducer.ts`**:
   - Change `ADD_MESSAGE` to increment `unreadCount` for selected chat when NOT at bottom
   - Need to pass `isAtBottom` context to reducer (or handle in component)

3. **`src/app.tsx`** or **`src/components/MessageView.tsx`**:
   - When `isAtBottom` changes to `true`, dispatch action to clear unread count
   - Call `markAsRead` API

---

## Task 1: Create Flash Configuration

**Files:**
- Create: `src/config/flashConfig.ts`

**Step 1: Create the config file**

```typescript
// src/config/flashConfig.ts
export const FLASH_CONFIG = {
  // Timing (milliseconds)
  onDuration: 200,
  offDuration: 150,

  // Repetitions
  chatFlashCount: 3,
  messageFlashCount: 1,
  indicatorFlashCount: 3,

  // Behavior
  restartOnNewMessage: true,
  stopOnSelect: true,
} as const;

export type FlashConfig = typeof FLASH_CONFIG;
```

**Step 2: Verify with typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/config/flashConfig.ts
git commit -m "feat(flash): add flash configuration"
```

---

## Task 2: Create useFlash Hook

**Files:**
- Create: `src/hooks/useFlash.ts`

**Step 1: Create hooks directory and hook file**

```typescript
// src/hooks/useFlash.ts
import { useState, useCallback, useRef } from "react";
import { FLASH_CONFIG } from "../config/flashConfig.js";

export function useFlash() {
  const [flashingIds, setFlashingIds] = useState<Set<string | number>>(
    new Set()
  );
  const timersRef = useRef<Map<string | number, NodeJS.Timeout[]>>(new Map());

  const startFlash = useCallback((id: string | number, count?: number) => {
    const flashCount = count ?? FLASH_CONFIG.chatFlashCount;

    // Clear existing timers (handles restart)
    const existing = timersRef.current.get(id);
    existing?.forEach(clearTimeout);

    const timers: NodeJS.Timeout[] = [];
    const cycleDuration = FLASH_CONFIG.onDuration + FLASH_CONFIG.offDuration;

    for (let i = 0; i < flashCount; i++) {
      // Turn ON
      timers.push(
        setTimeout(() => {
          setFlashingIds((prev) => new Set(prev).add(id));
        }, i * cycleDuration)
      );

      // Turn OFF
      timers.push(
        setTimeout(() => {
          setFlashingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, i * cycleDuration + FLASH_CONFIG.onDuration)
      );
    }

    timersRef.current.set(id, timers);
  }, []);

  const stopFlash = useCallback((id: string | number) => {
    const timers = timersRef.current.get(id);
    timers?.forEach(clearTimeout);
    timersRef.current.delete(id);
    setFlashingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isFlashing = useCallback(
    (id: string | number) => {
      return flashingIds.has(id);
    },
    [flashingIds]
  );

  return { startFlash, stopFlash, isFlashing };
}
```

**Step 2: Verify with typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/hooks/useFlash.ts
git commit -m "feat(flash): add useFlash hook for timing logic"
```

---

## Task 3: Integrate Flash into ChatList

**Files:**
- Modify: `src/components/ChatList.tsx`

**Step 1: Add imports and hook to ChatListInner**

Add at top of file:
```typescript
import { useEffect } from "react";
import { useFlash } from "../hooks/useFlash.js";
import { useTelegramService } from "../state/context.js";
import { FLASH_CONFIG } from "../config/flashConfig.js";
```

Update the import line to include `useEffect`:
```typescript
import { memo, useMemo, useEffect } from "react";
```

**Step 2: Update ChatRow to accept isFlashing prop**

Update ChatRow interface and component:
```typescript
const ChatRow = memo(function ChatRow({
  chat,
  isSelected,
  isActive,
  isFlashing,
}: {
  chat: Chat;
  isSelected: boolean;
  isActive: boolean;
  isFlashing: boolean;
}) {
  const hasUnread = chat.unreadCount > 0;
  const unreadIndicator = hasUnread ? "● " : "  ";
  const groupIndicator = chat.isGroup ? "# " : "  ";
  const title = chat.title.slice(0, 26);
  const suffix = hasUnread ? ` (${chat.unreadCount})` : "";

  return (
    <Text>
      <Text color={hasUnread ? "cyan" : undefined} inverse={isSelected || isFlashing}>
        {unreadIndicator}
      </Text>
      <Text color={chat.isGroup ? "magenta" : undefined} inverse={isSelected || isFlashing}>
        {groupIndicator}
      </Text>
      <Text
        inverse={isSelected || isFlashing}
        bold={hasUnread || isActive}
        color={isActive ? "cyan" : undefined}
      >
        {title}{suffix}
      </Text>
    </Text>
  );
});
```

**Step 3: Add flash logic to ChatListInner**

Inside ChatListInner, after the useMemo block, add:
```typescript
const { startFlash, stopFlash, isFlashing } = useFlash();
const telegramService = useTelegramService();

// Subscribe to new messages for flash
useEffect(() => {
  const unsub = telegramService.onNewMessage((message, chatId) => {
    if (!message.isOutgoing && chatId !== selectedChatId) {
      startFlash(chatId, FLASH_CONFIG.chatFlashCount);
    }
  });
  return unsub;
}, [telegramService, selectedChatId, startFlash]);

// Stop flash when chat is selected
useEffect(() => {
  if (FLASH_CONFIG.stopOnSelect && selectedChatId) {
    stopFlash(selectedChatId);
  }
}, [selectedChatId, stopFlash]);
```

**Step 4: Update ChatRow usage to pass isFlashing**

```typescript
<ChatRow
  key={chat.id}
  chat={chat}
  isSelected={isFocused && globalIndex === selectedIndex}
  isActive={chat.id === selectedChatId}
  isFlashing={isFlashing(chat.id)}
/>
```

**Step 5: Verify with typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/ChatList.tsx
git commit -m "feat(flash): integrate flash notifications into ChatList"
```

---

## Task 4: Integrate Flash into MessageView

**Files:**
- Modify: `src/components/MessageView.tsx`

**Step 1: Add imports**

Add to imports:
```typescript
import { useFlash } from "../hooks/useFlash.js";
import { useTelegramService } from "../state/context.js";
import { FLASH_CONFIG } from "../config/flashConfig.js";
```

**Step 2: Add props for selectedChatId and telegramService**

MessageView already has `chatId` prop. We need to add the telegramService. Update the props interface:
```typescript
interface MessageViewProps {
  // ... existing props ...
  onNewMessage: (callback: (message: Message, chatId: string) => void) => () => void;
}
```

Alternatively, use context inside component. The simpler approach is using context:

**Step 3: Add flash state and subscription inside MessageViewInner**

After the existing flash state declarations (around line 99-102), add:
```typescript
// New message flash state
const { startFlash: startMsgFlash, isFlashing: isMsgFlashing } = useFlash();
const {
  startFlash: startIndicatorFlash,
  isFlashing: isIndicatorFlashing,
} = useFlash();
const [newIndicatorVisible, setNewIndicatorVisible] = useState(false);
const telegramService = useTelegramService();

// Check if user is viewing the bottom of messages
const isAtBottom = useMemo(() => {
  return selectedIndex >= chatMessages.length - 1;
}, [selectedIndex, chatMessages.length]);

// Subscribe to new messages for this chat
useEffect(() => {
  const unsub = telegramService.onNewMessage((message, incomingChatId) => {
    if (message.isOutgoing || incomingChatId !== chatId) return;

    if (isAtBottom) {
      startMsgFlash(message.id, FLASH_CONFIG.messageFlashCount);
    } else {
      setNewIndicatorVisible(true);
      startIndicatorFlash("new-indicator", FLASH_CONFIG.indicatorFlashCount);
    }
  });
  return unsub;
}, [telegramService, chatId, isAtBottom, startMsgFlash, startIndicatorFlash]);

// Clear indicator when user scrolls to bottom
useEffect(() => {
  if (isAtBottom) {
    setNewIndicatorVisible(false);
  }
}, [isAtBottom]);
```

**Step 4: Update message rendering to use new flash**

In the classic layout rendering (around line 504), update the isFlashing check:
```typescript
const isFlashing = flashState?.messageId === msg.id || isMsgFlashing(msg.id);
```

In the bubble layout rendering (around line 359), update similarly:
```typescript
const isFlashing = flashState?.messageId === msg.id || isMsgFlashing(msg.id);
```

**Step 5: Add new indicator to render**

After the `showScrollDown` section (around line 577-579), add:
```typescript
{newIndicatorVisible && (
  <Text inverse={isIndicatorFlashing("new-indicator")} color="cyan">
    {" "}↓ new
  </Text>
)}
```

**Step 6: Verify with typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS

**Step 7: Test manually**

Run: `bun run dev --mock`
- Select a chat, scroll up
- Wait for mock messages
- Verify "↓ new" indicator appears and flashes
- Scroll to bottom, verify indicator disappears
- Switch to unselected chat list, verify chat rows flash

**Step 8: Commit**

```bash
git add src/components/MessageView.tsx
git commit -m "feat(flash): integrate flash notifications into MessageView"
```

---

## Task 5: Final Integration Test

**Step 1: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Manual testing with mock service**

Run: `bun run dev --mock`

Test scenarios:
1. New message in unselected chat → chat row flashes 3 times
2. Select flashing chat → flash stops immediately
3. New message in selected chat (at bottom) → message flashes once
4. Scroll up in selected chat, new message arrives → "↓ new" flashes
5. Scroll to bottom → indicator disappears
6. Multiple rapid messages → flash restarts

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(flash): complete new message flash notification system"
```

---

## File Changes Summary

**New files:**
- `src/config/flashConfig.ts` - Central flash configuration
- `src/hooks/useFlash.ts` - Reusable flash timing hook

**Modified files:**
- `src/components/ChatList.tsx` - Flash for unselected chats
- `src/components/MessageView.tsx` - Flash for messages + "↓ new" indicator

## Edge Cases

| Case | Behavior |
|------|----------|
| Multiple messages arrive rapidly | Restart flash sequence |
| User selects flashing chat | Stop flash immediately |
| User scrolls to bottom | Clear "↓ new" indicator |
| Outgoing messages | No flash |
