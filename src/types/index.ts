export type LogLevel = "quiet" | "info" | "verbose";
export type SessionMode = "persistent" | "ephemeral";
export type AuthMethod = "qr" | "phone";

export interface AppConfig {
  apiId: number | string;
  apiHash: string;
  sessionPersistence: SessionMode;
  logLevel: LogLevel;
  authMethod: AuthMethod;
}

export type ConnectionState = "disconnected" | "connecting" | "connected";
export type FocusedPanel = "chatList" | "messages" | "input";

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
}

export interface TelegramService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionState(): ConnectionState;
  getChats(): Promise<Chat[]>;
  getMessages(chatId: string, limit?: number): Promise<Message[]>;
  sendMessage(chatId: string, text: string): Promise<Message>;
  onConnectionStateChange(callback: (state: ConnectionState) => void): () => void;
  onNewMessage(callback: (message: Message, chatId: string) => void): () => void;
}
