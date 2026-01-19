import React, { createContext, useContext, useReducer, type Dispatch } from "react";
import { appReducer, initialState, type AppState, type AppAction } from "./reducer";
import type { TelegramService } from "../types";

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  telegramService: TelegramService | null;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  children: React.ReactNode;
  telegramService?: TelegramService | null;
}

export function AppProvider({ children, telegramService = null }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch, telegramService }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}

export function useAppState() {
  return useApp().state;
}

export function useAppDispatch() {
  return useApp().dispatch;
}

export function useTelegramService() {
  return useApp().telegramService;
}
