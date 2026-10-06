import type { Chat, ChatDraft, Delivery, Message, Notice, ConnectionState, FocusedPanel, CurrentView, MessageLayout, UiMode, SkinName } from "../types";
import { assignSenderColors, type SenderColors } from "../utils/senderColor";

interface MediaPanelState {
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
  senderColors: Record<string, SenderColors>;
  focusedPanel: FocusedPanel;
  loadingOlderMessages: Record<string, boolean>;
  hasMoreMessages: Record<string, boolean>;
  currentView: CurrentView;
  showLogoutPrompt: boolean;
  headerSelectedButton: "settings" | "logout";
  mediaPanel: MediaPanelState;
  messageLayout: MessageLayout;
  uiMode: UiMode;
  skin: SkinName;
  replyingToMessage: Message | null;
  editingMessage: Message | null;
  isHidden: boolean;
  typingChats: Record<string, boolean>;
  drafts: Record<string, ChatDraft>;
  notice: Notice | null;
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
  | { type: "INCREMENT_UNREAD"; payload: { chatId: string } }
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
  | { type: "SET_MESSAGE_LAYOUT"; payload: MessageLayout }
  | { type: "SET_UI_MODE"; payload: UiMode }
  | { type: "SET_SKIN"; payload: SkinName }
  | { type: "SET_HIDDEN"; payload: boolean }
  // Reaction actions
  | { type: "ADD_REACTION"; payload: { chatId: string; messageId: number; emoji: string } }
  | { type: "REMOVE_REACTION"; payload: { chatId: string; messageId: number } }
  // Reply/Edit actions
  | { type: "SET_REPLYING_TO"; payload: Message | null }
  | { type: "SET_EDITING_MESSAGE"; payload: Message | null }
  | { type: "UPDATE_MESSAGE"; payload: { chatId: string; messageId: number; newText: string; delivery?: Delivery } }
  // Delivery of sends/edits made from this client
  | { type: "CONFIRM_MESSAGE"; payload: { chatId: string; localId: number; message: Message } }
  | { type: "SET_DELIVERY"; payload: { chatId: string; messageId: number; delivery: Delivery | undefined } }
  | { type: "DISCARD_UNSENT"; payload: { chatId: string; messageId: number } }
  | { type: "SHOW_NOTICE"; payload: Omit<Notice, "id"> }
  | { type: "CLEAR_NOTICE"; payload?: { id: number } }
  | { type: "SET_TYPING"; payload: { chatId: string; isTyping: boolean } }
  | { type: "SAVE_DRAFT"; payload: { chatId: string; draft: ChatDraft } };

export const initialState: AppState = {
  connectionState: "disconnected",
  chats: [],
  selectedChatId: null,
  messages: {},
  senderColors: {},
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
  messageLayout: "classic",
  uiMode: "full",
  skin: "default",
  replyingToMessage: null,
  editingMessage: null,
  isHidden: false,
  typingChats: {},
  drafts: {},
  notice: null,
};

function withSenderColors(
  senderColors: Record<string, SenderColors>,
  chatId: string,
  messages: Message[],
): Record<string, SenderColors> {
  const existing = senderColors[chatId] ?? {};
  // Posts without a sender (e.g. channels) have senderId "" and get no color.
  const senderIds = messages.filter((m) => !m.isOutgoing && m.senderId).map((m) => m.senderId);
  const next = assignSenderColors(existing, senderIds);
  return next === existing ? senderColors : { ...senderColors, [chatId]: next };
}

function mapMessage(
  state: AppState,
  chatId: string,
  messageId: number,
  update: (msg: Message) => Message,
): AppState {
  const messages = state.messages[chatId];
  if (!messages) return state;
  return {
    ...state,
    messages: {
      ...state.messages,
      [chatId]: messages.map((msg) => (msg.id === messageId ? update(msg) : msg)),
    },
  };
}

// A reload replaces the list with server data; keep sends and edits that
// haven't been confirmed yet so they're never dropped silently.
function keepUnconfirmed(loaded: Message[], previous: Message[] | undefined): Message[] {
  const unconfirmed = previous?.filter((m) => m.delivery);
  if (!unconfirmed?.length) return loaded;
  const byId = new Map(unconfirmed.map((m) => [m.id, m]));
  const merged = loaded.map((m) => byId.get(m.id) ?? m);
  const loadedIds = new Set(loaded.map((m) => m.id));
  return [...merged, ...unconfirmed.filter((m) => !loadedIds.has(m.id))];
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_CONNECTION_STATE":
      return { ...state, connectionState: action.payload };

    case "SET_CHATS":
      return { ...state, chats: action.payload };

    case "SELECT_CHAT": {
      // Re-selecting the open chat keeps its in-progress reply/edit
      if (action.payload === state.selectedChatId) {
        return { ...state, focusedPanel: "messages" };
      }
      const draft = state.drafts[action.payload];
      return {
        ...state,
        selectedChatId: action.payload,
        focusedPanel: "messages",
        replyingToMessage: draft?.replyTo ?? null,
        editingMessage: draft?.editing ?? null,
      };
    }

    case "SET_MESSAGES":
      return {
        ...state,
        senderColors: withSenderColors(state.senderColors, action.payload.chatId, action.payload.messages),
        messages: {
          ...state.messages,
          [action.payload.chatId]: keepUnconfirmed(
            action.payload.messages,
            state.messages[action.payload.chatId],
          ),
        },
      };

    case "ADD_MESSAGE": {
      const { chatId, message } = action.payload;
      const existingMessages = state.messages[chatId] ?? [];
      // Deduplicate: only add if message ID doesn't already exist
      if (existingMessages.some(m => m.id === message.id)) {
        return state;
      }
      // Update chat's lastMessage, increment unreadCount if not selected, and move to top
      const chatIndex = state.chats.findIndex((c) => c.id === chatId);
      let updatedChats: Chat[];
      if (chatIndex >= 0) {
        const chat = state.chats[chatIndex]!;
        const updatedChat = {
          ...chat,
          lastMessage: message,
          unreadCount: state.selectedChatId === chatId ? chat.unreadCount : chat.unreadCount + 1,
        };
        // Move chat to top of list
        updatedChats = [
          updatedChat,
          ...state.chats.slice(0, chatIndex),
          ...state.chats.slice(chatIndex + 1),
        ];
      } else {
        updatedChats = state.chats;
      }
      return {
        ...state,
        chats: updatedChats,
        senderColors: withSenderColors(state.senderColors, chatId, [message]),
        messages: {
          ...state.messages,
          [chatId]: [
            ...existingMessages,
            message,
          ],
        },
      };
    }

    case "PREPEND_MESSAGES":
      return {
        ...state,
        senderColors: withSenderColors(state.senderColors, action.payload.chatId, action.payload.messages),
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

    case "INCREMENT_UNREAD":
      return {
        ...state,
        chats: state.chats.map((chat) =>
          chat.id === action.payload.chatId
            ? { ...chat, unreadCount: chat.unreadCount + 1 }
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
      return { ...initialState };

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

    case "SET_MESSAGE_LAYOUT":
      return { ...state, messageLayout: action.payload };

    case "SET_UI_MODE":
      return { ...state, uiMode: action.payload };

    case "SET_SKIN":
      return { ...state, skin: action.payload };

    case "SET_HIDDEN":
      return { ...state, isHidden: action.payload };

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

    // Reply and edit are exclusive. Ending an edit also clears the input
    // (InputBar's edit-sync effect).
    case "SET_REPLYING_TO":
      return {
        ...state,
        replyingToMessage: action.payload,
        editingMessage: action.payload ? null : state.editingMessage,
      };

    case "SET_EDITING_MESSAGE":
      return {
        ...state,
        editingMessage: action.payload,
        replyingToMessage: action.payload ? null : state.replyingToMessage,
      };

    case "UPDATE_MESSAGE": {
      const { chatId, messageId, newText, delivery } = action.payload;
      return mapMessage(state, chatId, messageId, (msg) => ({ ...msg, text: newText, delivery }));
    }

    case "CONFIRM_MESSAGE": {
      const { chatId, localId, message } = action.payload;
      const messages = state.messages[chatId] ?? [];
      // The NewMessage event may have delivered the real message first
      const alreadyAdded = messages.some((m) => m.id === message.id);
      const updatedMessages = alreadyAdded
        ? messages.filter((m) => m.id !== localId)
        : messages.map((m) => (m.id === localId ? message : m));
      return {
        ...state,
        chats: state.chats.map((chat) =>
          chat.id === chatId && chat.lastMessage?.id === localId
            ? { ...chat, lastMessage: message }
            : chat
        ),
        messages: { ...state.messages, [chatId]: updatedMessages },
      };
    }

    case "SET_DELIVERY": {
      const { chatId, messageId, delivery } = action.payload;
      return mapMessage(state, chatId, messageId, (msg) => ({ ...msg, delivery }));
    }

    case "DISCARD_UNSENT": {
      const { chatId, messageId } = action.payload;
      const messages = state.messages[chatId];
      const delivery = messages?.find((m) => m.id === messageId)?.delivery;
      if (!messages || !delivery) return state;
      if (delivery.action === "edit") {
        return mapMessage(state, chatId, messageId, (msg) => ({
          ...msg,
          text: delivery.originalText,
          delivery: undefined,
        }));
      }
      return {
        ...state,
        messages: { ...state.messages, [chatId]: messages.filter((m) => m.id !== messageId) },
      };
    }

    case "SHOW_NOTICE":
      return { ...state, notice: { ...action.payload, id: (state.notice?.id ?? 0) + 1 } };

    case "CLEAR_NOTICE":
      if (!state.notice) return state;
      // An expiring timer must not clear a newer notice
      if (action.payload && action.payload.id !== state.notice.id) return state;
      return { ...state, notice: null };

    case "SET_TYPING": {
      const { chatId, isTyping } = action.payload;
      if (isTyping) {
        return { ...state, typingChats: { ...state.typingChats, [chatId]: true } };
      }
      if (!state.typingChats[chatId]) return state;
      const next = { ...state.typingChats };
      delete next[chatId];
      return { ...state, typingChats: next };
    }

    case "SAVE_DRAFT": {
      const { chatId, draft } = action.payload;
      if (draft.text.trim() || draft.replyTo || draft.editing) {
        return { ...state, drafts: { ...state.drafts, [chatId]: draft } };
      }
      // Nothing worth keeping: discard any previous draft
      if (!state.drafts[chatId]) return state;
      const next = { ...state.drafts };
      delete next[chatId];
      return { ...state, drafts: next };
    }

    default:
      return state;
  }
}
