import type { Chat, Message, ConnectionState, FocusedPanel } from "../types";

export interface AppState {
  connectionState: ConnectionState;
  chats: Chat[];
  selectedChatId: string | null;
  messages: Record<string, Message[]>;
  focusedPanel: FocusedPanel;
  loadingOlderMessages: Record<string, boolean>;
  hasMoreMessages: Record<string, boolean>;
}

export type AppAction =
  | { type: "SET_CONNECTION_STATE"; payload: ConnectionState }
  | { type: "SET_CHATS"; payload: Chat[] }
  | { type: "SELECT_CHAT"; payload: string }
  | { type: "SET_MESSAGES"; payload: { chatId: string; messages: Message[] } }
  | { type: "ADD_MESSAGE"; payload: { chatId: string; message: Message } }
  | { type: "PREPEND_MESSAGES"; payload: { chatId: string; messages: Message[] } }
  | { type: "SET_FOCUSED_PANEL"; payload: AppState["focusedPanel"] }
  | { type: "UPDATE_UNREAD_COUNT"; payload: { chatId: string; count: number } }
  | { type: "SET_LOADING_OLDER_MESSAGES"; payload: { chatId: string; loading: boolean } }
  | { type: "SET_HAS_MORE_MESSAGES"; payload: { chatId: string; hasMore: boolean } };

export const initialState: AppState = {
  connectionState: "disconnected",
  chats: [],
  selectedChatId: null,
  messages: {},
  focusedPanel: "chatList",
  loadingOlderMessages: {},
  hasMoreMessages: {},
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_CONNECTION_STATE":
      return { ...state, connectionState: action.payload };

    case "SET_CHATS":
      return { ...state, chats: action.payload };

    case "SELECT_CHAT":
      return { ...state, selectedChatId: action.payload, focusedPanel: "messages" };

    case "SET_MESSAGES":
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: action.payload.messages,
        },
      };

    case "ADD_MESSAGE":
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: [
            ...(state.messages[action.payload.chatId] ?? []),
            action.payload.message,
          ],
        },
      };

    case "PREPEND_MESSAGES":
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: [
            ...action.payload.messages,
            ...(state.messages[action.payload.chatId] ?? []),
          ],
        },
      };

    case "SET_LOADING_OLDER_MESSAGES":
      return {
        ...state,
        loadingOlderMessages: {
          ...state.loadingOlderMessages,
          [action.payload.chatId]: action.payload.loading,
        },
      };

    case "SET_HAS_MORE_MESSAGES":
      return {
        ...state,
        hasMoreMessages: {
          ...state.hasMoreMessages,
          [action.payload.chatId]: action.payload.hasMore,
        },
      };

    case "SET_FOCUSED_PANEL":
      return { ...state, focusedPanel: action.payload };

    case "UPDATE_UNREAD_COUNT":
      return {
        ...state,
        chats: state.chats.map((chat) =>
          chat.id === action.payload.chatId
            ? { ...chat, unreadCount: action.payload.count }
            : chat
        ),
      };

    default:
      return state;
  }
}
