# Custom Hooks

[WHAT] Fns that call other Hooks = reusable stateful logic:

```jsx
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return isOnline;
}
```

Comps call declaratively:

```jsx
function StatusBar() {
  const isOnline = useOnlineStatus();
  return <h1>{isOnline ? "Online" : "Disconnected"}</h1>;
}
```

[SHARE LOGIC !STATE] Each call -> completely independent state; to share state itself, lift up + pass as props.

```jsx
function Form() {
  const firstNameProps = useFormInput("Mary"); // independent state
  const lastNameProps = useFormInput("Poppins"); // independent state
}

function useFormInput(initialValue) {
  const [value, setValue] = useState(initialValue);
  function handleChange(e) {
    setValue(e.target.value);
  }
  return { value, onChange: handleChange };
}
```

[NAMING] `use`+capital required | !Hooks inside -> !`use` prefix (`getSorted`) | >=1 Hook -> `use` prefix | linter enforces

```jsx
// Bad: "Hook" that doesn't use Hooks
function useSorted(items) {
  return items.slice().sort();
}

// Good: regular function
function getSorted(items) {
  return items.slice().sort();
}

// Good: uses useContext, so it's a Hook
function useAuth() {
  return useContext(Auth);
}
```

[REACTIVE VALUES] Custom Hooks re-r every re-r, always receive latest props/state:

```jsx
export function useChatRoom({ serverUrl, roomId }) {
  useEffect(() => {
    const connection = createConnection({ serverUrl, roomId });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId, serverUrl]);
}

// In component:
useChatRoom({ roomId, serverUrl }); // re-synchronizes when either changes
```

[EVENT HANDLERS] cb changes every render -> wrap with useEffectEvent:

```jsx
export function useChatRoom({ serverUrl, roomId, onReceiveMessage }) {
  const onMessage = useEffectEvent(onReceiveMessage);

  useEffect(() => {
    const connection = createConnection({ serverUrl, roomId });
    connection.connect();
    connection.on("message", (msg) => onMessage(msg));
    return () => connection.disconnect();
  }, [roomId, serverUrl]); // onReceiveMessage NOT in deps
}
```

[WHEN TO EXTRACT] Do: duplicated Effect logic | declarative comp code hiding impl | easier migration to new APIs. !Do: trivial duplication (single useState) | generic lifecycle wrappers.

[ANTI-PATTERN: LIFECYCLE HOOKS]

```jsx
// BAD: all of these fight React's reactive model
function useMount(fn) {
  useEffect(() => {
    fn();
  }, []); // missing dependency: 'fn'
}
useMount(fn);
useEffectOnce(fn);
useUpdateEffect(fn);
```

Problems: linter only checks direct useEffect -> dep bugs undetected | encourages "on mount" vs "synchronize with X" | !react to prop/state changes.
Good names = purpose: `useChatRoom({serverUrl,roomId})` | `useImpressionLog('visit_chat',{roomId})` | `useMediaQuery(query)` | `useIntersectionObserver(ref,options)`

[PATTERN: useData]

```jsx
function useData(url) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (url) {
      let ignore = false;
      fetch(url)
        .then((r) => r.json())
        .then((json) => {
          if (!ignore) setData(json);
        });
      return () => {
        ignore = true;
      };
    }
  }, [url]);
  return data;
}

// Usage:
function ShippingForm({ country }) {
  const cities = useData(`/api/cities?country=${country}`);
  const [city, setCity] = useState(null);
  const areas = useData(city ? `/api/areas?city=${city}` : null);
}
```

[PATTERN: useSyncExternalStore] >> useState+useEffect for external stores:

```jsx
import { useSyncExternalStore } from "react";

function subscribe(callback) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function useOnlineStatus() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine, // client value
    () => true // server value (SSR)
  );
}
```

Logic in custom Hook -> no consuming comps need change when internals updated.

[DESIGN BOUNDARIES] Custom Hooks compose other Hooks:

```jsx
export function useFadeIn(ref, duration) {
  useEffect(() => {
    const animation = new FadeInAnimation(ref.current);
    animation.start(duration);
    return () => animation.stop();
  }, [ref, duration]);
}
```

More Effect coordination needed -> extract completely out of Hooks into plain JS classes; Effect just connects React to external system.

Future: React's `use` API with Suspense:

```jsx
import { use, Suspense } from "react";
function Message({ messagePromise }) {
  const content = use(messagePromise);
  return <p>{content}</p>;
}
```

Custom Hooks like useData now -> easier migration to `use`-based patterns.
