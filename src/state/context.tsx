import React, { createContext, useContext, useReducer, useMemo, type Dispatch } from "react";
import { appReducer, initialState, type AppState, type AppAction } from "./reducer";
import type { TelegramService } from "../types";

// Split contexts to prevent unnecessary re-renders
// Components needing only dispatch won't re-render when state changes
const AppStateContext = createContext<AppState | null>(null);
const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null);
const TelegramServiceContext = createContext<TelegramService | null>(null);

interface AppProviderProps {
  children: React.ReactNode;
  telegramService?: TelegramService | null;
}

export function AppProvider({ children, telegramService = null }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

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

export function useAppState() {
  const state = useContext(AppStateContext);
  if (state === null) {
    throw new Error("useAppState must be used within AppProvider");
  }
  return state;
}

export function useAppDispatch() {
  const dispatch = useContext(AppDispatchContext);
  if (dispatch === null) {
    throw new Error("useAppDispatch must be used within AppProvider");
  }
  return dispatch;
}

export function useTelegramService() {
  return useContext(TelegramServiceContext);
}
