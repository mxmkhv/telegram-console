# Effect Anti-Patterns

[1. DERIVED STATE] useEffect+setState -> calculate during render

```jsx
// WRONG
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(firstName + " " + lastName);
}, [firstName, lastName]);

// CORRECT
const fullName = firstName + " " + lastName;
```

[2. EXPENSIVE CALC] useEffect+setState -> useMemo (>=1ms)

```jsx
// WRONG
const [visibleTodos, setVisibleTodos] = useState([]);
useEffect(() => {
  setVisibleTodos(getFilteredTodos(todos, filter));
}, [todos, filter]);

// CORRECT (cheap)
const visibleTodos = getFilteredTodos(todos, filter);

// CORRECT (expensive -- >= 1ms)
const visibleTodos = useMemo(
  () => getFilteredTodos(todos, filter),
  [todos, filter]
);
```

[3. RESET ALL STATE] useEffect+setState -> `key` prop forces fresh comp instance

```jsx
// WRONG: renders stale value first, then re-renders
function ProfilePage({ userId }) {
  const [comment, setComment] = useState("");
  useEffect(() => {
    setComment("");
  }, [userId]);
}

// CORRECT: key forces fresh component instance
function ProfilePage({ userId }) {
  return <Profile userId={userId} key={userId} />;
}
function Profile({ userId }) {
  const [comment, setComment] = useState(""); // resets automatically
}
```

[4. ADJUST SOME STATE] useEffect+setState -> derive from minimal state

```jsx
// WRONG
function List({ items }) {
  const [selection, setSelection] = useState(null);
  useEffect(() => {
    setSelection(null);
  }, [items]);
}

// CORRECT: derive from minimal state
function List({ items }) {
  const [selectedId, setSelectedId] = useState(null);
  const selection = items.find((item) => item.id === selectedId) ?? null;
}
```

[5. EVENT LOGIC] useEffect watching state -> event handler. Rule: user interaction = event handler

```jsx
// WRONG: fires on page reload too
useEffect(() => {
  if (product.isInCart) showNotification(`Added ${product.name}!`);
}, [product]);

// CORRECT: in event handler
function handleBuyClick() {
  addToCart(product);
  showNotification(`Added ${product.name}!`);
}
```

[6. POST REQUEST] useEffect watching state -> event handler (analytics OK in Effect)

```jsx
// WRONG
useEffect(() => {
  if (jsonToSubmit !== null) post("/api/register", jsonToSubmit);
}, [jsonToSubmit]);

// CORRECT: analytics in Effect, submission in handler
useEffect(() => {
  post("/analytics/event", { eventName: "visit_form" });
}, []);
function handleSubmit(e) {
  e.preventDefault();
  post("/api/register", { firstName, lastName });
}
```

[7. EFFECT CHAINS] multiple useEffects -> single event handler. Exception: OK when each Effect syncs w/ different external system

```jsx
// WRONG: cascading re-renders
useEffect(() => {
  if (card?.gold) setGoldCardCount((c) => c + 1);
}, [card]);
useEffect(() => {
  if (goldCardCount > 3) {
    setRound((r) => r + 1);
    setGoldCardCount(0);
  }
}, [goldCardCount]);
useEffect(() => {
  if (round > 5) setIsGameOver(true);
}, [round]);

// CORRECT: compute in event handler
const isGameOver = round > 5;
function handlePlaceCard(nextCard) {
  if (isGameOver) throw Error("Game already ended.");
  setCard(nextCard);
  if (nextCard.gold) {
    if (goldCardCount < 3) {
      setGoldCardCount(goldCardCount + 1);
    } else {
      setGoldCardCount(0);
      setRound(round + 1);
    }
  }
}
```

[8. APP INIT] useEffect(fn,[]) runs 2x in dev -> module-level guard

```jsx
// WRONG: runs twice in dev
function App() {
  useEffect(() => {
    loadDataFromLocalStorage();
    checkAuthToken();
  }, []);
}

// CORRECT: module-level guard
let didInit = false;
function App() {
  useEffect(() => {
    if (!didInit) {
      didInit = true;
      loadDataFromLocalStorage();
      checkAuthToken();
    }
  }, []);
}

// ALSO CORRECT: module scope
if (typeof window !== "undefined") {
  checkAuthToken();
  loadDataFromLocalStorage();
}
```

[9. NOTIFY PARENT] useEffect calling onChange -> call onChange in event handler (React batches both)

```jsx
// WRONG: extra render cycle
function Toggle({ onChange }) {
  const [isOn, setIsOn] = useState(false);
  useEffect(() => {
    onChange(isOn);
  }, [isOn, onChange]);
  function handleClick() {
    setIsOn(!isOn);
  }
}

// CORRECT: call onChange in same event (React batches both updates)
function Toggle({ onChange }) {
  const [isOn, setIsOn] = useState(false);
  function updateToggle(nextIsOn) {
    setIsOn(nextIsOn);
    onChange(nextIsOn);
  }
  function handleClick() {
    updateToggle(!isOn);
  }
}

// ALSO CORRECT: fully controlled
function Toggle({ isOn, onChange }) {
  function handleClick() {
    onChange(!isOn);
  }
}
```

[10. PASS DATA UP] child Effect calling parent setter -> parent owns data, passes down

```jsx
// WRONG: child fetches, passes to parent via Effect
function Child({ onFetched }) {
  const data = useSomeAPI();
  useEffect(() => {
    if (data) onFetched(data);
  }, [onFetched, data]);
}

// CORRECT: parent fetches, passes data down
function Parent() {
  const data = useSomeAPI();
  return <Child data={data} />;
}
```

[11. EXTERNAL STORE] useEffect+addEventListener -> useSyncExternalStore

```jsx
// NOT IDEAL: manual subscription
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    function update() {
      setIsOnline(navigator.onLine);
    }
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return isOnline;
}

// CORRECT: useSyncExternalStore
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
    () => navigator.onLine,
    () => true
  );
}
```

[12. DATA FETCHING] ! cleanup = race condition -> useEffect WITH cleanup

```jsx
// WRONG: race condition
useEffect(() => {
  fetchResults(query, page).then((json) => setResults(json));
}, [query, page]);

// CORRECT: cleanup ignores stale responses
useEffect(() => {
  let ignore = false;
  fetchResults(query, page).then((json) => {
    if (!ignore) setResults(json);
  });
  return () => {
    ignore = true;
  };
}, [query, page]);
```

[DECISION SUMMARY]
Derived values: useEffect+setState -> calc during render | Expensive derived: useEffect+setState -> `useMemo` | Reset all state: useEffect+setState -> `key` prop | Adjust some state: useEffect+setState -> derive from minimal state | Interaction logic: useEffect watching state -> event handler | POST submit: useEffect watching state -> event handler | Chained updates: multiple useEffects -> single event handler | App init: useEffect(fn,[]) -> module-level guard | Notify parent: useEffect calling onChange -> onChange in event handler | Pass data up: child Effect+parent setter -> parent owns data, passes down | External store: useEffect+addEventListener -> `useSyncExternalStore` | Data fetching: useEffect !cleanup -> useEffect WITH cleanup
