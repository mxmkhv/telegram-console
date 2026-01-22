import type { Chat, Message, ConnectionState, FocusedPanel, CurrentView, MessageLayout } from "../types";

export interface InlinePreviewState {
  loading: boolean;
  imageData: string | null;
  error: string | null;
}

export interface MediaPanelState {
  isOpen: boolean;
  messageId: number | null;
  loading: boolean;
  imageData: string | null;
  error: string | null;
}

export interface AppState {
  connectionState: ConnectionState;
  chats: Chat[];
  selectedChatId: string | null;
  messages: Record<string, Message[]>;
  focusedPanel: FocusedPanel;
  loadingOlderMessages: Record<string, boolean>;
  hasMoreMessages: Record<string, boolean>;
  currentView: CurrentView;
  showLogoutPrompt: boolean;
  headerSelectedButton: "settings" | "logout";
  mediaPanel: MediaPanelState;
  inlinePreviews: Map<number, InlinePreviewState>;
  messageLayout: MessageLayout;
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
  | { type: "SET_HAS_MORE_MESSAGES"; payload: { chatId: string; hasMore: boolean } }
  | { type: "SET_CURRENT_VIEW"; payload: CurrentView }
  | { type: "SET_SHOW_LOGOUT_PROMPT"; payload: boolean }
  | { type: "SET_HEADER_SELECTED_BUTTON"; payload: "settings" | "logout" }
  | { type: "RESET_STATE" }
  // Media panel actions
  | { type: "OPEN_MEDIA_PANEL"; payload: { messageId: number } }
  | { type: "CLOSE_MEDIA_PANEL" }
  | { type: "SET_MEDIA_LOADING"; payload: boolean }
  | { type: "SET_MEDIA_DATA"; payload: string }
  | { type: "SET_MEDIA_ERROR"; payload: string }
  // Inline preview actions
  | { type: "SET_INLINE_PREVIEW_LOADING"; payload: { messageId: number } }
  | { type: "SET_INLINE_PREVIEW_DATA"; payload: { messageId: number; imageData: string } }
  | { type: "SET_INLINE_PREVIEW_ERROR"; payload: { messageId: number; error: string } }
  | { type: "SET_MESSAGE_LAYOUT"; payload: MessageLayout }
  // Reaction actions
  | { type: "ADD_REACTION"; payload: { chatId: string; messageId: number; emoji: string } }
  | { type: "REMOVE_REACTION"; payload: { chatId: string; messageId: number } };

export const initialState: AppState = {
  connectionState: "disconnected",
  chats: [],
  selectedChatId: null,
  messages: {},
  focusedPanel: "chatList",
  loadingOlderMessages: {},
  hasMoreMessages: {},
  currentView: "chat",
  showLogoutPrompt: false,
  headerSelectedButton: "settings",
  mediaPanel: {
    isOpen: false,
    messageId: null,
    loading: false,
    imageData: null,
    error: null,
  },
  inlinePreviews: new Map(),
  messageLayout: "classic",
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

    case "ADD_MESSAGE": {
      const existingMessages = state.messages[action.payload.chatId] ?? [];
      // Deduplicate: only add if message ID doesn't already exist
      if (existingMessages.some(m => m.id === action.payload.message.id)) {
        return state;
      }
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: [
            ...existingMessages,
            action.payload.message,
          ],
        },
      };
    }

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

    case "SET_CURRENT_VIEW":
      return { ...state, currentView: action.payload };

    case "SET_SHOW_LOGOUT_PROMPT":
      return { ...state, showLogoutPrompt: action.payload };

    case "SET_HEADER_SELECTED_BUTTON":
      return { ...state, headerSelectedButton: action.payload };

    case "RESET_STATE":
      return { ...initialState, inlinePreviews: new Map() };

    // Media panel actions
    case "OPEN_MEDIA_PANEL":
      return {
        ...state,
        mediaPanel: {
          isOpen: true,
          messageId: action.payload.messageId,
          loading: false,
          imageData: null,
          error: null,
        },
      };

    case "CLOSE_MEDIA_PANEL":
      return {
        ...state,
        mediaPanel: {
          isOpen: false,
          messageId: null,
          loading: false,
          imageData: null,
          error: null,
        },
      };

    case "SET_MEDIA_LOADING":
      return {
        ...state,
        mediaPanel: {
          ...state.mediaPanel,
          loading: action.payload,
          error: null,
        },
      };

    case "SET_MEDIA_DATA":
      return {
        ...state,
        mediaPanel: {
          ...state.mediaPanel,
          loading: false,
          imageData: action.payload,
          error: null,
        },
      };

    case "SET_MEDIA_ERROR":
      return {
        ...state,
        mediaPanel: {
          ...state.mediaPanel,
          loading: false,
          imageData: null,
          error: action.payload,
        },
      };

    // Inline preview actions
    case "SET_INLINE_PREVIEW_LOADING": {
      const newPreviews = new Map(state.inlinePreviews);
      newPreviews.set(action.payload.messageId, {
        loading: true,
        imageData: null,
        error: null,
      });
      return { ...state, inlinePreviews: newPreviews };
    }

    case "SET_INLINE_PREVIEW_DATA": {
      const newPreviews = new Map(state.inlinePreviews);
      newPreviews.set(action.payload.messageId, {
        loading: false,
        imageData: action.payload.imageData,
        error: null,
      });
      return { ...state, inlinePreviews: newPreviews };
    }

    case "SET_INLINE_PREVIEW_ERROR": {
      const newPreviews = new Map(state.inlinePreviews);
      newPreviews.set(action.payload.messageId, {
        loading: false,
        imageData: null,
        error: action.payload.error,
      });
      return { ...state, inlinePreviews: newPreviews };
    }

    case "SET_MESSAGE_LAYOUT":
      return { ...state, messageLayout: action.payload };

    case "ADD_REACTION": {
      const { chatId, messageId, emoji } = action.payload;
      const messages = state.messages[chatId];
      if (!messages) return state;

      const updatedMessages = messages.map((msg) => {
        if (msg.id !== messageId) return msg;

        const reactions = msg.reactions ?? [];
        const existingIndex = reactions.findIndex((r) => r.emoji === emoji);

        if (existingIndex >= 0) {
          const updated = reactions.map((r, i) =>
            i === existingIndex ? { ...r, count: r.count + 1, hasUserReacted: true } : r
          );
          return { ...msg, reactions: updated };
        } else {
          return {
            ...msg,
            reactions: [...reactions, { emoji, count: 1, hasUserReacted: true }],
          };
        }
      });

      return {
        ...state,
        messages: { ...state.messages, [chatId]: updatedMessages },
      };
    }

    case "REMOVE_REACTION": {
      const { chatId, messageId } = action.payload;
      const messages = state.messages[chatId];
      if (!messages) return state;

      const updatedMessages = messages.map((msg) => {
        if (msg.id !== messageId) return msg;

        const reactions = msg.reactions ?? [];
        const userReactionIndex = reactions.findIndex((r) => r.hasUserReacted);
        if (userReactionIndex < 0) return msg;

        const reaction = reactions[userReactionIndex]!;
        if (reaction.count <= 1) {
          return { ...msg, reactions: reactions.filter((_, i) => i !== userReactionIndex) };
        } else {
          const updated = reactions.map((r, i) =>
            i === userReactionIndex ? { ...r, count: r.count - 1, hasUserReacted: false } : r
          );
          return { ...msg, reactions: updated };
        }
      });

      return {
        ...state,
        messages: { ...state.messages, [chatId]: updatedMessages },
      };
    }

    default:
      return state;
  }
}
