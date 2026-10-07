import type { Api } from "telegram";

type LogLevel = "quiet" | "info" | "verbose";
type SessionMode = "persistent" | "ephemeral";
export type AuthMethod = "qr" | "phone";
export type MessageLayout = "classic" | "bubble";
export type UiMode = "full" | "minimal";
export type SkinName = "default" | "claudeCode";

export interface AppConfig {
  apiId: number | string;
  apiHash: string;
  sessionPersistence: SessionMode;
  logLevel: LogLevel;
  authMethod: AuthMethod;
  messageLayout: MessageLayout;
  uiMode: UiMode;
  noColor: boolean;
  skin: SkinName;
  notifications: NotificationMode;
}

/** For new messages in chats you're not viewing; the title's unread count shows either way */
export type NotificationMode = "all" | "bell" | "off";

export type ConnectionState = "disconnected" | "connecting" | "connected";
export type LoadStatus = "loading" | "ready" | "error";
export type FocusedPanel = "header" | "chatList" | "messages" | "input" | "mediaPanel";
export type CurrentView = "chat" | "settings";
export type LogoutMode = "session" | "full";

type MediaType =
  | "photo"
  | "sticker"
  | "gif"
  | "video"
  | "videoNote"
  | "voice"
  | "audio"
  | "document"
  | "poll"
  | "location"
  | "contact"
  // Dice, games, invoices, stories and kinds this client can't show
  | "other";

export interface MediaAttachment {
  type: MediaType;
  /** Poll question, place, contact or song; for "other", what it is */
  title?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  emoji?: string;           // for stickers
  isAnimated?: boolean;     // TGS/video stickers
  fileName?: string;
  duration?: number;        // for voice/video in seconds
  _message: Api.Message;    // GramJS reference for download
}

// Result of a clipboard-image send attempt, surfaced to the composer so it can
// show a transient status ("✓ Image sent" / "No image in clipboard").
export interface ImageSendResult {
  ok: boolean;
  error?: string;
}

interface MessageReaction {
  emoji: string;
  count: number;
  hasUserReacted: boolean;
}

/** Reactions as an update reports them */
export interface ReportedReaction {
  emoji: string;
  count: number;
  /** Undefined when Telegram left it out (`min` updates): the copy you have knows better */
  hasUserReacted: boolean | undefined;
}

export interface Chat {
  id: string;
  title: string;
  unreadCount: number;
  lastMessage?: Message;
  isGroup: boolean;
  /** Muted in Telegram: no bell or notification, and left out of the title's count */
  isMuted?: boolean;
}

export interface Message {
  id: number;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  isOutgoing: boolean;
  media?: MediaAttachment;
  reactions?: MessageReaction[];
  replyToMsgId?: number;        // ID of message this replies to
  replyToSenderName?: string;   // Sender name for display
  forwardedFrom?: string;       // Who wrote it, when it's a forward
  delivery?: Delivery;          // Set while a send/edit from this client is unconfirmed
}

// A send or edit made from this client that Telegram hasn't confirmed yet.
// Unsent messages carry a negative local id until the server assigns one.
export type Delivery =
  | { action: "send"; status: "pending" | "failed" }
  | { action: "edit"; status: "pending" | "failed"; originalText: string };

// Transient feedback line above the input. Sticky notices stay until replaced.
export interface Notice {
  id: number;
  kind: "error" | "info";
  text: string;
  sticky?: boolean;
}

// Unsent input for a chat, kept in memory for the session
export interface ChatDraft {
  text: string;
  replyTo: Message | null;
  editing: Message | null;
}

export interface TelegramService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionState(): ConnectionState;
  getChats(): Promise<Chat[]>;
  getMessages(chatId: string, limit?: number, offsetId?: number): Promise<Message[]>;
  sendMessage(chatId: string, text: string, replyToMsgId?: number, replyToSenderName?: string): Promise<Message>;
  sendImage(chatId: string, filePath: string): Promise<Message>;
  editMessage(chatId: string, messageId: number, newText: string): Promise<Message>;
  markAsRead(chatId: string, maxMessageId?: number): Promise<boolean>;
  sendReaction(chatId: string, messageId: number, emoji: string): Promise<boolean>;
  removeReaction(chatId: string, messageId: number): Promise<boolean>;
  onConnectionStateChange(callback: (state: ConnectionState) => void): () => void;
  onNewMessage(callback: (message: Message, chatId: string) => void): () => void;
  /** An edit, by anyone. In private chats and small groups, reaction changes arrive this way too. */
  onMessageEdited(callback: (message: Message, chatId: string) => void): () => void;
  /**
   * Deleted messages. Without a chat id they're from private chats or small
   * groups, where message ids are unique across all of them.
   */
  onMessagesDeleted(callback: (messageIds: number[], chatId: string | undefined) => void): () => void;
  /** Reaction counts changed (groups and channels) */
  onReactionsChanged(callback: (chatId: string, messageId: number, reactions: ReportedReaction[]) => void): () => void;
  onTyping(callback: (chatId: string, isTyping: boolean) => void): () => void;
  downloadMedia(message: Message): Promise<Buffer | undefined>;
}
