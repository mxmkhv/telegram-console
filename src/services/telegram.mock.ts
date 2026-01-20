import type { TelegramService, ConnectionState, Chat, Message } from "../types";

const MOCK_CHATS: Chat[] = [
  { id: "1", title: "John Doe", unreadCount: 2, isGroup: false },
  { id: "2", title: "Jane Smith", unreadCount: 0, isGroup: false },
  { id: "3", title: "Work Group", unreadCount: 5, isGroup: true },
  { id: "4", title: "Family", unreadCount: 0, isGroup: true },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  "1": [
    { id: 1, senderId: "1", senderName: "John", text: "Hey, how are you?", timestamp: new Date("2026-01-19T10:30:00"), isOutgoing: false },
    { id: 2, senderId: "me", senderName: "You", text: "I'm good, thanks!", timestamp: new Date("2026-01-19T10:31:00"), isOutgoing: true },
    { id: 3, senderId: "1", senderName: "John", text: "Great to hear", timestamp: new Date("2026-01-19T10:32:00"), isOutgoing: false },
  ],
  "2": [
    { id: 1, senderId: "2", senderName: "Jane", text: "Meeting at 3pm?", timestamp: new Date("2026-01-19T09:00:00"), isOutgoing: false },
  ],
  "3": [
    { id: 1, senderId: "3", senderName: "Bob", text: "Project update ready", timestamp: new Date("2026-01-19T08:00:00"), isOutgoing: false },
  ],
  "4": [
    { id: 1, senderId: "4", senderName: "Mom", text: "Dinner on Sunday?", timestamp: new Date("2026-01-18T18:00:00"), isOutgoing: false },
  ],
};

export function createMockTelegramService(): TelegramService {
  let connectionState: ConnectionState = "disconnected";
  let connectionCallback: ((state: ConnectionState) => void) | null = null;
  let _messageCallback: ((message: Message, chatId: string) => void) | null = null;
  const messages = structuredClone(MOCK_MESSAGES);

  return {
    async connect() {
      connectionState = "connecting";
      connectionCallback?.(connectionState);
      await new Promise((r) => setTimeout(r, 100));
      connectionState = "connected";
      connectionCallback?.(connectionState);
    },

    async disconnect() {
      connectionState = "disconnected";
      connectionCallback?.(connectionState);
    },

    getConnectionState() {
      return connectionState;
    },

    async getChats() {
      return [...MOCK_CHATS];
    },

    async getMessages(chatId: string, limit = 50) {
      return (messages[chatId] ?? []).slice(-limit);
    },

    async sendMessage(chatId: string, text: string) {
      const message: Message = {
        id: Date.now(),
        senderId: "me",
        senderName: "You",
        text,
        timestamp: new Date(),
        isOutgoing: true,
      };
      if (!messages[chatId]) {
        messages[chatId] = [];
      }
      messages[chatId]!.push(message);
      return message;
    },

    onConnectionStateChange(callback) {
      connectionCallback = callback;
      return () => {
        if (connectionCallback === callback) {
          connectionCallback = null;
        }
      };
    },

    onNewMessage(callback) {
      _messageCallback = callback;
      return () => {
        if (_messageCallback === callback) {
          _messageCallback = null;
        }
      };
    },
  };
}
