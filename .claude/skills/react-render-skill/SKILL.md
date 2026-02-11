---
name: react-render-skill
description: React rendering, Effects, refs, and custom Hooks expert knowledge base. Use when writing, reviewing, or debugging React components involving useEffect, useRef, refs, custom Hooks, dependency arrays, cleanup functions, or when deciding if an Effect is needed. Also use when encountering issues with stale closures, unnecessary re-renders, Effect dependency warnings, or when refactoring class components to Hooks. Covers escape hatches (refs, Effects, custom Hooks), anti-patterns, and correct patterns for synchronizing with external systems.
---

# React Rendering & Effects Guide

Authoritative reference for React escape hatches: refs, Effects, and custom Hooks. Based on official React documentation.

## Quick Decision: Do You Need an Effect?

**Ask: "Why does this code need to run?"**

| Reason                                                                  | Use                     |
| ----------------------------------------------------------------------- | ----------------------- |
| Props/state changed and you need a derived value                        | Calculate during render |
| User performed a specific interaction                                   | Event handler           |
| Component was displayed to the user                                     | Effect                  |
| Synchronize with external system (network, DOM API, third-party widget) | Effect                  |

**If there is no external system involved, you almost certainly don't need an Effect.**

## Core Concepts

### Refs (`useRef`)

- Store values that persist across renders without triggering re-renders
- Access via `ref.current` (mutable, synchronous)
- **Never read/write `ref.current` during rendering** (exception: lazy init `if (!ref.current) ref.current = new Thing()`)
- Use for: timeout/interval IDs, DOM elements, non-rendering data

**Refs vs State:** State triggers re-renders; refs don't. State is immutable (use setter); refs are mutable. State has render snapshots; refs are always current.

### DOM Refs

```jsx
const inputRef = useRef(null);
// ...
<input ref={inputRef} />;
// After commit: inputRef.current is the DOM node
inputRef.current.focus();
```

- React sets `ref.current` during commit phase, not during render
- For lists of refs, use a ref callback with a `Map` -- see [refs-and-dom.md](references/refs-and-dom.md)
- Forward refs to child components via the `ref` prop; restrict with `useImperativeHandle`
- Use `flushSync` when you need state updates flushed to DOM before reading it

### Effects (`useEffect`)

Effects synchronize components with external systems. They run after render (during commit).

```jsx
useEffect(() => {
  // setup: start synchronizing
  const connection = createConnection(serverUrl, roomId);
  connection.connect();
  return () => {
    // cleanup: stop synchronizing
    connection.disconnect();
  };
}, [roomId]); // re-run when roomId changes
```

**Dependency array behavior:**

- `useEffect(fn)` -- runs after every render
- `useEffect(fn, [])` -- runs on mount only
- `useEffect(fn, [a, b])` -- runs on mount + when a or b change (compared with `Object.is`)

**You cannot choose your dependencies.** They are determined by the reactive values read inside the Effect. The linter enforces this. **Never suppress the linter.**

**Dev mode:** Strict Mode runs Effects twice (mount -> unmount -> mount) to verify cleanup works.

For full Effect patterns, cleanup examples, and the lifecycle model, see [effects-guide.md](references/effects-guide.md).

## Critical: Anti-Patterns to Avoid

Full catalog of 12 anti-patterns with correct alternatives in [anti-patterns.md](references/anti-patterns.md).

**Most common mistakes:**

1. **Derived state in Effect** -- Calculate during render instead
2. **Event logic in Effect** -- Use event handlers instead
3. **Resetting state on prop change** -- Use `key` prop instead
4. **Chains of Effects** -- Consolidate logic in event handler
5. **Object/function dependencies** -- Move inside Effect or extract primitives

## Dependency Management

When dependencies cause problems (too frequent, infinite loops), **change the code, not the deps:**

1. Move non-reactive values outside the component
2. Move dynamic objects/functions inside the Effect
3. Extract primitives from object props via destructuring
4. Use updater functions: `setCount(c => c + 1)` instead of reading `count`
5. Use `useEffectEvent` to read reactive values without re-triggering the Effect

See [dependencies-and-events.md](references/dependencies-and-events.md) for full strategies.

## Custom Hooks

- Must start with `use` + capital letter
- Share **stateful logic**, not state itself -- each call creates independent state
- Re-run on every render like components; code must be pure
- Wrap received event handler callbacks in `useEffectEvent`
- Name after purpose (`useChatRoom`), not lifecycle (`useMount`)

**Anti-pattern:** Don't create `useMount`, `useEffectOnce`, `useUpdateEffect` -- these hide dependency bugs and fight React's reactive model.

See [custom-hooks.md](references/custom-hooks.md) for patterns and examples.

## Reference Files

| File                                                                | Content                                                                |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [refs-and-dom.md](references/refs-and-dom.md)                       | Refs, DOM manipulation, ref callbacks, forwarding, flushSync           |
| [effects-guide.md](references/effects-guide.md)                     | Effect lifecycle, cleanup patterns, dev mode, data fetching            |
| [anti-patterns.md](references/anti-patterns.md)                     | 12 anti-patterns with correct alternatives and decision table          |
| [dependencies-and-events.md](references/dependencies-and-events.md) | Dependency strategies, useEffectEvent, object/function pitfalls        |
| [custom-hooks.md](references/custom-hooks.md)                       | Custom Hook patterns, naming, composing, useData, useSyncExternalStore |
