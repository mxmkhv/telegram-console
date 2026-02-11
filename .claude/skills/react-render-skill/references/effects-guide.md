# Effects Guide

[LOGIC TYPES]
Rendering code = during render, must be pure, ! side effects
Event handlers = user interaction response, side effects from user action
Effects = after render/commit, side effects from rendering itself
Key: message send = event (click-caused) vs connection setup = Effect (comp appears)

[WRITING useEffect]
Step 1 - Declare:

```jsx
useEffect(() => {
  // Runs after render
});
```

Step 2 - Specify deps:

```jsx
useEffect(() => { ... });          // Every render
useEffect(() => { ... }, []);      // Mount only
useEffect(() => { ... }, [a, b]);  // Mount + when a or b change
```

Compared w/ `Object.is`. Skipped when ALL deps unchanged.
You !choose deps -- determined by reactive values used inside. Linter enforces.

Step 3 - Cleanup:

```jsx
useEffect(() => {
  const connection = createConnection();
  connection.connect();
  return () => connection.disconnect(); // cleanup
}, []);
```

Cleanup runs: before Effect re-runs (re-r w/ changed deps) | on unmount

[CLEANUP PATTERNS]
Event subscriptions:

```jsx
useEffect(() => {
  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll);
}, []);
```

Animations:

```jsx
useEffect(() => {
  const node = ref.current;
  node.style.opacity = 1;
  return () => {
    node.style.opacity = 0;
  };
}, []);
```

Idempotent APIs (no cleanup needed):

```jsx
useEffect(() => {
  map.setZoomLevel(zoomLevel); // calling twice with same value is harmless
}, [zoomLevel]);
```

Non-idempotent APIs:

```jsx
useEffect(() => {
  const dialog = dialogRef.current;
  dialog.showModal();
  return () => dialog.close();
}, []);
```

Data fetching (ignore stale):

```jsx
useEffect(() => {
  let ignore = false;
  async function fetchData() {
    const json = await fetchTodos(userId);
    if (!ignore) setTodos(json);
  }
  fetchData();
  return () => {
    ignore = true;
  };
}, [userId]);
```

[DEV MODE]
Strict Mode remounts every comp once (mount->unmount->mount) to expose missing cleanup.
Sequence: 1.mount+Effect 2.simulated unmount+cleanup 3.simulated remount+Effect
Production: mount once only.
Right Q: !"how to run once" -> "how to fix so it works after remount"
! use refs to suppress double-firing:

```jsx
// BAD: hides the bug
const connectionRef = useRef(null);
useEffect(() => {
  if (!connectionRef.current) {
    connectionRef.current = createConnection();
    connectionRef.current.connect();
  }
}, []);
// Connection is never cleaned up on unmount!
```

[LIFECYCLE]
Comp: mount->update->unmount | Effect: start sync->stop sync (repeats)
Think from Effect's perspective. Well-written Effect = resilient to start/stop any # of times.
ChatRoom `roomId` walkthrough:
1.Mount roomId="general" -> connects "general"
2.Re-r same roomId -> deps unchanged, skipped
3.Re-r roomId="travel" -> cleanup#1 disconnects "general", new Effect connects "travel"
4.Unmount -> cleanup#3 disconnects "travel"
Each render has own Effects (closures capture render values).

[ONE PROCESS PER EFFECT]
! combine unrelated logic in one Effect:

```jsx
// BAD: analytics + connection in one Effect
useEffect(() => {
  logVisit(roomId);
  const connection = createConnection(serverUrl, roomId);
  connection.connect();
  return () => connection.disconnect();
}, [roomId]);

// GOOD: separate Effects
useEffect(() => {
  logVisit(roomId);
}, [roomId]);
useEffect(() => {
  const connection = createConnection(serverUrl, roomId);
  connection.connect();
  return () => connection.disconnect();
}, [roomId]);
```

Test: can you delete one Effect w/o breaking the other? If yes -> separate.

[REACTIVE VALUES]
All values in comp body are reactive: props|state|context|derived vars+fns.
Must be in dep array if read by Effect.
Non-reactive: module-level constants | values inside Effect | `useState` setter (stable) | `useRef` ret value (stable, but !`ref.current`)

[DATA FETCHING]
Effects for fetching work but downsides: !SSR, network waterfalls, !caching, race condition boilerplate. >> framework data fetching or cache libs (TanStack Query, useSWR).
Always include cleanup:

```jsx
function useData(url) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let ignore = false;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (!ignore) setData(json);
      });
    return () => {
      ignore = true;
    };
  }, [url]);
  return data;
}
```

[!EFFECT]
App init -> run at module level:

```jsx
if (typeof window !== 'undefined') {
  checkAuthToken();
  loadDataFromLocalStorage();
}
function App() { ... }
```

User-initiated actions -> put in event handler:

```jsx
// Put in event handler, not Effect
function handleClick() {
  fetch("/api/buy", { method: "POST" });
}
```

Rule: if remounting breaks the logic, it probably !should be an Effect.
