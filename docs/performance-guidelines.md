# Ink TUI Performance Guidelines

**Target:** High-frequency applications (Chat Clients, Log Streamers)
**Goal:** Zero flicker, <16ms render time, responsive keyboard input.

## 1. The Rendering Model (Why it flickers)

Unlike the DOM, the terminal is a serial output stream.

1.  React Reconciles (Virtual DOM diff).
2.  Ink recalculates layout (Yoga/Flexbox).
3.  Ink converts the tree to a string with ANSI codes.
4.  **The Bottleneck:** Node writes this string to `process.stdout`.

**Flicker happens when:**

- You write to `stdout` faster than the terminal emulator can repaint. Beware of that!
- The layout calculation takes too long, causing a delay between the "clear screen" command and the "draw new content" command.

---

## 2. React Optimization Strategies

### Aggressive Memoization

In a browser, re-rendering a generic `<div>` is cheap. In a terminal, re-rendering a `<Box>` triggers a Yoga layout recalculation.

- **Rule:** Wrap **every** major structural component (Sidebar, Header, MessageList) in `React.memo`.
- **Why:** If the `Sidebar` props haven't changed, Ink skips the layout calculation for that entire branch of the tree.

```tsx
// ❌ Bad: Renders sidebar every time a message arrives
const App = ({ messages }) => (
  <Box>
    <Sidebar />
    <ChatArea messages={messages} />
  </Box>
);

// ✅ Good: Sidebar layout is cached until its specific props change
const MemoizedSidebar = React.memo(Sidebar);

const App = ({ messages }) => (
  <Box>
    <MemoizedSidebar />
    <ChatArea messages={messages} />
  </Box>
);
```

### State Colocation (Push State Down)

Do not keep high-frequency state at the root.

- **Scenario:** A user is typing a message.
- **Bad Pattern:** Storing `inputValue` in the root `App` component. Every keystroke re-renders the Sidebar and MessageList.
- **Best Practice:** Keep `inputValue` inside the `InputComponent` only. Use a callback only on "Submit".

---

## 3. List Virtualization (The Chat Client Killer)

You cannot render a mapped array of 1000 components. It will consume 100% CPU and lag keyboard input.

**The Golden Rule:**
Only render the rows that physically fit on the screen.

1.  **Calculate Height:** Use `useStdoutDimensions()` to know the terminal height.
2.  **Slice Data:** Maintain a `scrollOffset`.
3.  **Render Window:**
    ```typescript
    const visibleMessages = allMessages.slice(
      scrollOffset,
      scrollOffset + viewportHeight,
    );
    ```

---

## 4. Throttle High-Frequency Updates

Telegram updates or file download progress can fire 100s of times per second. React will try to render 100s of times per second.

### The Throttling Pattern

Don't connect the socket directly to the React state setter for every event.

**For Progress Bars:**
Update visual state max 10-20 times per second. The human eye in a terminal cannot track faster changes anyway.

```typescript
// Example: Throttle progress updates
useEffect(() => {
  const unsubscribe = downloadTask.on("progress", (percent) => {
    // Only set state if 50ms have passed since last update
    throttleSetState(percent);
  });
  return unsubscribe;
}, []);
```

**For Incoming Messages:**
Use a buffer. If 50 messages arrive in 100ms, push them to a queue, and flush that queue to the React state once every 100ms.

---

## 5. Console Hygiene

- **NEVER** use `console.log` inside an Ink app. It writes directly to `stdout`, interfering with Ink's internal buffer, causing the UI to "jump" or break layout.
- **Debugging:**
  - Use a file logger (write to `debug.log`).
  - Or use a specific component `<Static>` dedicated to logs at the top of the screen (not recommended for complex layouts).

---

## 6. Layout Stability

Yoga Layout calculations are expensive.

- **Fixed Dimensions:** Wherever possible, give panels fixed width/height or explicit percentages.
- **Avoid "Auto" Layouts in Loops:** If you have a list of items, try to ensure they have predictable heights. Variable height items (like chat bubbles) force the layout engine to work harder.

## 7. Checklist for "Jank" Debugging

If the TUI feels slow:

1.  [ ] Are you rendering invisible items? (Implement Virtualization).
2.  [ ] Is a text input causing the entire screen to repaint? (Colocate State).
3.  [ ] Is `console.log` leaking output?
4.  [ ] Are you using `React.memo` on the Sidebar and inactive panels?
5.  [ ] Are you using complex gradients on every character? (Plain colors render faster than calculated gradients).
