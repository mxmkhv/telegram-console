# TUI Development Guidelines & Best Practices

**Context:** React-based Terminal User Interfaces (Ink)
**Project:** Telegram Console Client

## 1. Core Philosophy

Treat the terminal as a unique medium, not a web browser.

- **Constraint-First Design:** Respect the grid. Elements must align to character cells.
- **Keyboard Supremacy:** The UI must be fully navigable without a mouse. Visual states must reflect focus instantly.
- **Performance is Visibility:** In a terminal, "jank" manifests as screen flickering. Render performance is critical for UX.

## 2. Visual Architecture

### Layout (The Box Model)

Ink relies on Yoga (Flexbox).

- **Structure:** Use strictly nested `<Box>` components.
- **Separation:** Use `borderStyle` ("single", "double", "round") to define clear panel boundaries (Sidebar vs. Chat vs. Input).
- **Spacing:** Use padding to create "breathable" UIs. Negative space indicates a premium tool. Crowded text is hard to scan.

### Typography & Hierarchy

CSS does not exist. Use ANSI capabilities effectively.

- **Primary Content:** Standard brightness / White.
- **Metadata (Time/Status):** `dimColor` (gray). This reduces visual noise.
- **Active/Focused State:** Bold, Underline, or Inverse colors.
- **Alerts/Errors:** Red/Yellow.
- **Brand:** Use gradients (`ink-gradient`) sparingly, mostly for headers or splash screens.

## 3. Interaction Design

### Focus Management

Since there is no "hover," the "Focused" state is the primary interactive cue.

- **State Tracking:** Maintain a global or context-level state for which pane is active (e.g., `activePane: 'sidebar' | 'chat'`).
- **Visual Cues:**
  - **Inactive Pane:** Dim border color, grey text.
  - **Active Pane:** Bright border color (Cyan/Green), bright text.
  - **Selected Item:** Invert background/foreground colors.

### Input Handling

- **Global Shortcuts:** Use `useInput` hooks at the root level for app-wide navigation (e.g., `Ctrl+C` to quit, `Tab` to switch panels).
- **Input Blocking:** When a modal or input field is active, ensure navigation keys (arrows/vim keys) do not leak to the background layers.

## 4. Performance & Rendering (Anti-Flicker)

Flickering is the most common failure mode in Ink apps.

### Rendering Rules

1.  **Stdout Hygiene:** Ensure NO other libraries (loggers, raw `console.log`) write to stdout. This corrupts the TUI buffer.
2.  **Memoization:** Aggressively use `React.memo`, `useMemo`, and `useCallback`.
    - _Bad:_ Re-rendering the sidebar when a new message arrives in the main chat.
    - _Good:_ The sidebar only re-renders if the list of active chats changes.
3.  **Virtualization:** **Never** render a mapped array of 10,000 items (e.g., chat history).
    - Calculate the viewport height (e.g., 20 rows).
    - Slice the message array to render only the visible subset based on scroll offset.

## 5. Specific Component Patterns

### The Chat Window

- **Sticky Scrolling:** Logic is needed to keep the view pinned to the bottom when new messages arrive _unless_ the user has scrolled up to read history.
- **Spinners:** Use `ink-spinner` for network states (Connecting, Sending).
- **Progress:** Use `ink-progress-bar` for media uploads/downloads. Do not spam updates; throttle progress renders to ~10fps to prevent render-thrashing.

### The Input Field

- Use `ink-text-input`.
- Ensure the cursor is strictly managed. If focus leaves the input box, the cursor should hide or move to the new focus point.

## 6. Libraries & Tooling

- **Layout:** `ink` (Core), `yoga-layout-prebuilt`
- **Input:** `ink-text-input`, `ink-select-input` (for menus)
- **Visuals:** `ink-gradient`, `ink-big-text`
- **Utilities:** `ink-use-focus-manager` (optional, but custom hooks often work better for complex layouts)
- **State:** Zustand or Redux (recommended for managing Telegram state separately from UI state).

## 7. Comparison Standards

Benchmark UX against mature TUIs:

- **LazyGit (Go):** Standard for modal management and keybindings.
- **gh-dash (Go):** Standard for dashboard layouts.
- **htop/btop (C++):** Standard for information density.
