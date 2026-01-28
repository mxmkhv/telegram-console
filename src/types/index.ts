import type { Api } from "telegram";

export type LogLevel = "quiet" | "info" | "verbose";
export type SessionMode = "persistent" | "ephemeral";
export type AuthMethod = "qr" | "phone";
export type MessageLayout = "classic" | "bubble";

export interface AppConfig {
  apiId: number | string;
  apiHash: string;
  sessionPersistence: SessionMode;
  logLevel: LogLevel;
  authMethod: AuthMethod;
  messageLayout: MessageLayout;
}

export type ConnectionState = "disconnected" | "connecting" | "connected";
export type FocusedPanel = "header" | "chatList" | "messages" | "input" | "mediaPanel";
export type CurrentView = "chat" | "settings";
export type LogoutMode = "session" | "full";

export type MediaType = "photo" | "sticker" | "gif" | "video" | "document" | "voice";

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

export interface MessageReaction {
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

export interface TelegramService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionState(): ConnectionState;
  getChats(): Promise<Chat[]>;
  getMessages(chatId: string, limit?: number, offsetId?: number): Promise<Message[]>;
  sendMessage(chatId: string, text: string, replyToMsgId?: number, replyToSenderName?: string): Promise<Message>;
  editMessage(chatId: string, messageId: number, newText: string): Promise<Message>;
  markAsRead(chatId: string, maxMessageId?: number): Promise<boolean>;
  sendReaction(chatId: string, messageId: number, emoji: string): Promise<boolean>;
  removeReaction(chatId: string, messageId: number): Promise<boolean>;
  onConnectionStateChange(callback: (state: ConnectionState) => void): () => void;
  onNewMessage(callback: (message: Message, chatId: string) => void): () => void;
  downloadMedia(message: Message): Promise<Buffer | undefined>;
}
