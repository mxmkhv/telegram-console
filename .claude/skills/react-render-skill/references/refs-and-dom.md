# Refs & DOM

[useRef BASICS]

```jsx
import { useRef } from "react";
const ref = useRef(0);
// ref = { current: 0 }
```

Ret `{ current: initialValue }` -- plain mutable JS obj. Persists across re-rs (like state). Changing `ref.current` !re-r (unlike state). Mutations sync: `ref.current = 5; console.log(ref.current); // 5`

Conceptually useRef = useState w/o setter:

```js
function useRef(initialValue) {
  const [ref, unused] = useState({ current: initialValue });
  return ref;
}
```

[REFS vs STATE]
`useRef(init)` ret `{current:init}` | `useState(init)` ret `[val,setVal]`
!re-r on change | re-r on change
Mutable -- modify `current` directly | Immutable -- must -> setter fn
!read/write during render | read anytime; each render = own snapshot

[WHEN TO USE REFS]
-> when comp needs to "step outside" React: timeout/interval IDs | DOM elements | objects !needed for JSX calc
Rule: impacts rendering -> state. Only event handlers & !re-r needed -> ref.

[BEST PRACTICES]
Refs = escape hatch -- !build primary data flow on them. !read/write `ref.current` during rendering (unpredictable). Exception: lazy init `if (!ref.current) ref.current = new Thing()`. React !track ref contents.
Gotcha: local vars reset on re-r. Timeout ID in `let timeoutID = null` lost on re-r -> useRef instead.

[DOM REFS]

```jsx
const inputRef = useRef(null);
// ...
<input ref={inputRef} />;
// After mount: inputRef.current is the <input> DOM element
inputRef.current.focus();
```

React sets `ref.current` = DOM element on mount, `null` on unmount.

[REF CALLBACKS FOR LISTS]
!useRef in loop -> ref cb w/ `Map`:

```jsx
function CatFriends() {
  const itemsRef = useRef(null);

  function getMap() {
    if (!itemsRef.current) itemsRef.current = new Map();
    return itemsRef.current;
  }

  return (
    <ul>
      {catList.map((cat) => (
        <li
          key={cat.id}
          ref={(node) => {
            const map = getMap();
            map.set(cat, node);
            return () => {
              map.delete(cat);
            };
          }}
        >
          <img src={cat.imageUrl} />
        </li>
      ))}
    </ul>
  );
}
```

Strict Mode: ref cbs run 2x in dev.

[FORWARDING REFS]

```jsx
function MyInput({ ref }) {
  return <input ref={ref} />;
}

function MyForm() {
  const inputRef = useRef(null);
  return <MyInput ref={inputRef} />;
}
```

[useImperativeHandle]
Restrict parent access:

```jsx
function MyInput({ ref }) {
  const realInputRef = useRef(null);
  useImperativeHandle(ref, () => ({
    focus() {
      realInputRef.current.focus();
    }
  }));
  return <input ref={realInputRef} />;
}
```

Parent `ref.current` only has `focus` -- !raw DOM node.

[WHEN REACT ATTACHES REFS]
2 phases: 1) Render -- React calls comps (refs = `null`/stale) 2) Commit -- React updates DOM, sets `ref.current`
Access refs from event handlers !during rendering. No event -> Effect.

[flushSync]
State updates batched. Set state then read DOM -> !reflect yet.

```jsx
import { flushSync } from "react-dom";

function handleAdd() {
  const newTodo = { id: nextId++, text };
  flushSync(() => {
    setText("");
    setTodos([...todos, newTodo]);
  });
  // DOM is now updated
  listRef.current.lastChild.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}
```

[DOM MANIPULATION SAFETY]
Safe: focus, scroll, measure -- non-destructive. Dangerous: modify/add/remove children from React-managed nodes -- crashes. Exception: safely modify DOM React !updates (e.g. always-empty `<div>`).
