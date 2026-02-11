# Effect deps & Effect Events

[DEPS MUST MATCH CODE]
Every reactive value (props, state, derived vars) read by Effect must be in deps. The list describes your code -- you ! choose it.
Change deps workflow: 1) change Effect code or reactive value declarations 2) follow linter, adjust deps to match 3) if unhappy w/ deps -> step 1

[! SUPPRESS LINTER]

```jsx
// NEVER DO THIS
useEffect(() => {
  // ...
  // eslint-ignore-next-line react-hooks/exhaustive-deps
}, []);
```

Suppression bug -- stale closure captures initial render values forever:

```jsx
function Timer() {
  const [count, setCount] = useState(0);
  const [increment, setIncrement] = useState(1);

  function onTick() {
    setCount(count + increment);
  }

  useEffect(() => {
    const id = setInterval(onTick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
// BUG: count is always 1 because onTick is stale
```

! suppress linter = ! stale value bugs.

[STRATEGIES]

1. Move event logic -> event handlers

```jsx
// BAD
useEffect(() => {
  if (submitted) {
    post("/api/register");
    showNotification("Done!", theme);
  }
}, [submitted, theme]);

// GOOD
function handleSubmit() {
  post("/api/register");
  showNotification("Done!", theme);
}
```

2. Split unrelated Effects

```jsx
// BAD: country change refetches areas unnecessarily
useEffect(() => {
  fetch(`/api/cities?country=${country}`).then(/* ... */);
  if (city) fetch(`/api/areas?city=${city}`).then(/* ... */);
}, [country, city]);

// GOOD
useEffect(() => {
  fetch(`/api/cities?country=${country}`).then(/* ... */);
}, [country]);
useEffect(() => {
  if (city) fetch(`/api/areas?city=${city}`).then(/* ... */);
}, [city]);
```

3. -> updater fns to remove state from deps

```jsx
// BAD: messages dependency causes reconnect on every message
useEffect(() => {
  connection.on("message", (msg) => {
    setMessages([...messages, msg]);
  });
  return () => connection.disconnect();
}, [roomId, messages]);

// GOOD: updater removes messages dependency
useEffect(() => {
  connection.on("message", (msg) => {
    setMessages((msgs) => [...msgs, msg]);
  });
  return () => connection.disconnect();
}, [roomId]);
```

4. Move non-reactive values outside comp

```jsx
const serverUrl = "https://localhost:1234"; // not reactive
const roomId = "music"; // not reactive

function ChatRoom() {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    return () => connection.disconnect();
  }, []); // no reactive values used
}
```

5. Move values inside Effect

```jsx
function ChatRoom() {
  useEffect(() => {
    const serverUrl = "https://localhost:1234"; // not reactive
    const roomId = "general"; // not reactive
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    return () => connection.disconnect();
  }, []);
}
```

[useEffectEvent]
Extracts non-reactive logic from Effects. Always sees latest props/state but ! reactive -- changes to values it reads ! re-trigger Effect.

BAD: theme in deps causes unnecessary reconnect:

```jsx
// BAD: re-connects when theme changes
useEffect(() => {
  const connection = createConnection(serverUrl, roomId);
  connection.on("connected", () => {
    showNotification("Connected!", theme);
  });
  connection.connect();
  return () => connection.disconnect();
}, [roomId, theme]); // theme causes unnecessary reconnection
```

GOOD: useEffectEvent isolates theme:

```jsx
import { useEffect, useEffectEvent } from "react";

const onConnected = useEffectEvent(() => {
  showNotification("Connected!", theme); // reads latest theme
});

useEffect(() => {
  const connection = createConnection(serverUrl, roomId);
  connection.on("connected", () => {
    onConnected();
  });
  connection.connect();
  return () => connection.disconnect();
}, [roomId]); // theme is no longer a dependency
```

Pass reactive values you want to react to as args -> useEffectEvent (makes reactive/non-reactive boundary explicit):

```jsx
function Page({ url }) {
  const { items } = useContext(ShoppingCartContext);
  const numberOfItems = items.length;

  const onVisit = useEffectEvent((visitedUrl) => {
    logVisit(visitedUrl, numberOfItems); // always reads latest numberOfItems
  });

  useEffect(() => {
    onVisit(url); // reactive with respect to url only
  }, [url]);
}
```

useEffectEvent limits: only call from inside Effects | ! pass to other comps/Hooks | declare next to Effect that uses them

```jsx
// BAD: passing Effect Event to another Hook
const onTick = useEffectEvent(() => {
  setCount(count + 1);
});
useTimer(onTick, 1000);

// GOOD: declare inside the Hook that uses it
function useTimer(callback, delay) {
  const onTick = useEffectEvent(() => {
    callback();
  });
  useEffect(() => {
    const id = setInterval(() => {
      onTick();
    }, delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

[OBJ & FN PITFALLS]
Objs/fns created in comp body = new refs every render -> Effect re-syncs every re-r.

```js
const obj1 = { serverUrl: "https://localhost:1234", roomId: "music" };
const obj2 = { serverUrl: "https://localhost:1234", roomId: "music" };
Object.is(obj1, obj2); // false
```

Fix static: move outside comp

```jsx
const options = { serverUrl: "https://localhost:1234", roomId: "music" };
function ChatRoom() {
  useEffect(() => {
    const connection = createConnection(options);
    connection.connect();
    return () => connection.disconnect();
  }, []);
}
```

Fix dynamic: move inside Effect

```jsx
function ChatRoom({ roomId }) {
  useEffect(() => {
    const options = { serverUrl, roomId };
    const connection = createConnection(options);
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]); // only primitive is a dependency
}
```

Fix obj props: destructure primitives

```jsx
function ChatRoom({ options }) {
  const { roomId, serverUrl } = options;
  useEffect(() => {
    const connection = createConnection({ roomId, serverUrl });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId, serverUrl]);
}
```

Fix fn props: call outside Effect

```jsx
function ChatRoom({ getOptions }) {
  const { roomId, serverUrl } = getOptions(); // call during render (must be pure)
  useEffect(() => {
    const connection = createConnection({ roomId, serverUrl });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId, serverUrl]);
}
```

[REACTIVE VALUES]
Reactive (must be in deps): props | state | context values | vars/fns computed from above during rendering
Not reactive (safe to omit): module-level constants outside comp | values inside Effect | useState setter (stable) | useRef ret value (stable, but ! ref.current)
Cannot be deps: location.pathname (mutable outside React) | ref.current (mutable, ! trigger re-r)
-> useSyncExternalStore to subscribe to external mutable values.
