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
}

export type ConnectionState = "disconnected" | "connecting" | "connected";
export type FocusedPanel = "header" | "chatList" | "messages" | "input" | "mediaPanel";
export type CurrentView = "chat" | "settings";
export type LogoutMode = "session" | "full";

type MediaType = "photo" | "sticker" | "gif" | "video" | "document" | "voice";

export interface MediaAttachment {
  type: MediaType;
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

export interface Chat {
  id: string;
  title: string;
  unreadCount: number;
  lastMessage?: Message;
  isGroup: boolean;
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
}

// Unsent input for a chat, kept while the user is elsewhere
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
  onTyping(callback: (chatId: string, isTyping: boolean) => void): () => void;
  downloadMedia(message: Message): Promise<Buffer | undefined>;
}
