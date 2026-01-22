import type { TelegramService, ConnectionState, Chat, Message } from "../types";

const MOCK_CHATS: Chat[] = [
  { id: "1", title: "John Doe", unreadCount: 2, isGroup: false },
  { id: "2", title: "Jane Smith", unreadCount: 0, isGroup: false },
  { id: "3", title: "Work Group", unreadCount: 5, isGroup: true },
  { id: "4", title: "Family", unreadCount: 0, isGroup: true },
];

// Generate a large conversation for testing infinite scroll
function generateMockMessages(chatId: string, senderName: string, count: number): Message[] {
  const messages: Message[] = [];
  const baseDate = new Date("2026-01-01T10:00:00");

  for (let i = 1; i <= count; i++) {
    const isOutgoing = i % 3 === 0;
    messages.push({
      id: i,
      senderId: isOutgoing ? "me" : chatId,
      senderName: isOutgoing ? "You" : senderName,
      text: `Message ${i} in chat ${chatId}`,
      timestamp: new Date(baseDate.getTime() + i * 60000), // 1 minute apart
      isOutgoing,
    });
  }

  return messages;
}

const MOCK_MESSAGES: Record<string, Message[]> = {
  "1": generateMockMessages("1", "John", 150),  // 150 messages for testing infinite scroll
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

    async getMessages(chatId: string, limit = 50, offsetId?: number) {
      const chatMessages = messages[chatId] ?? [];
      if (offsetId !== undefined) {
        // Return messages older than offsetId (simulating GramJS behavior)
        const offsetIndex = chatMessages.findIndex((m) => m.id === offsetId);
        if (offsetIndex <= 0) {
          return [];
        }
        // Get messages before the offset, take up to limit, maintaining chronological order
        const olderMessages = chatMessages.slice(0, offsetIndex);
        return olderMessages.slice(-limit);
      }
      // No offset: return most recent messages
      return chatMessages.slice(-limit);
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

    async downloadMedia(_message: Message): Promise<Buffer | undefined> {
      // Mock: return undefined since we don't have real media in mock
      return undefined;
    },

    async markAsRead(_chatId: string, _maxMessageId?: number): Promise<boolean> {
      // Mock: always succeed
      return true;
    },

    async sendReaction(_chatId: string, _messageId: number, _emoji: string): Promise<boolean> {
      return true;
    },

    async removeReaction(_chatId: string, _messageId: number): Promise<boolean> {
      return true;
    },
  };
}
