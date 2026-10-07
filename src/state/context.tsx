import React, { createContext, useContext, useReducer, useMemo, type Dispatch } from "react";
import { appReducer, initialState, type AppState, type AppAction } from "./reducer";
import type { TelegramService, UiMode, SkinName, NotificationMode, MessageLayout } from "../types";

// Split contexts to prevent unnecessary re-renders
// Components needing only dispatch won't re-render when state changes
const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null);
const TelegramServiceContext = createContext<TelegramService | null>(null);

interface AppProviderProps {
  children: React.ReactNode;
  telegramService?: TelegramService | null;
  initialUiMode?: UiMode;
  initialMessageLayout?: MessageLayout;
  initialSkin?: SkinName;
  initialNotifications?: NotificationMode;
  initialConvertEmoticons?: boolean;
}

export function AppProvider({
  children,
  telegramService = null,
  initialUiMode,
  initialMessageLayout,
  initialSkin,
  initialNotifications,
  initialConvertEmoticons,
}: AppProviderProps) {
  const [state, dispatch] = useReducer(
    appReducer,
    initialState,
    (base) => ({
      ...base,
      ...(initialUiMode ? { uiMode: initialUiMode } : null),
      ...(initialMessageLayout ? { messageLayout: initialMessageLayout } : null),
      ...(initialSkin ? { skin: initialSkin } : null),
      ...(initialNotifications ? { notifications: initialNotifications } : null),
      ...(initialConvertEmoticons !== undefined ? { convertEmoticons: initialConvertEmoticons } : null),
    }),
  );

  // Memoize telegramService to prevent context value changes
  const memoizedService = useMemo(() => telegramService, [telegramService]);

  return (
    <AppDispatchContext.Provider value={dispatch}>
      <TelegramServiceContext.Provider value={memoizedService}>
        <AppStateContext.Provider value={state}>
          {children}
        </AppStateContext.Provider>
      </TelegramServiceContext.Provider>
    </AppDispatchContext.Provider>
  );
}

export function useApp() {
  const state = useContext(AppStateContext);
  const dispatch = useContext(AppDispatchContext);
  const telegramService = useContext(TelegramServiceContext);
  if (state === null || dispatch === null) {
    throw new Error("useApp must be used within AppProvider");
  }
  return { state, dispatch, telegramService };
}

export function useTelegramService() {
  return useContext(TelegramServiceContext);
}
