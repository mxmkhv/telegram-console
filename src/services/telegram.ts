import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import type { TelegramService, ConnectionState, Message } from "../types";

export interface TelegramServiceOptions {
  apiId: number;
  apiHash: string;
  session?: string;
  onSessionUpdate?: (session: string) => void;
}

export function createTelegramService(options: TelegramServiceOptions): TelegramService & { client: TelegramClient } {
  const { apiId, apiHash, session = "", onSessionUpdate } = options;
  const stringSession = new StringSession(session);
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  let connectionState: ConnectionState = "disconnected";
  let connectionCallback: ((state: ConnectionState) => void) | null = null;
  let _messageCallback: ((message: Message, chatId: string) => void) | null = null;

  function setConnectionState(state: ConnectionState) {
    connectionState = state;
    connectionCallback?.(state);
  }

  return {
    client,

    async connect() {
      setConnectionState("connecting");
      await client.connect();
      setConnectionState("connected");
      onSessionUpdate?.(client.session.save() as unknown as string);

      client.addEventHandler((event: Api.TypeUpdate) => {
        if (event instanceof Api.UpdateNewMessage && event.message instanceof Api.Message) {
          const msg = event.message;
          const chatId = msg.peerId?.toString() ?? "";
          const message: Message = {
            id: msg.id,
            senderId: msg.fromId?.toString() ?? "",
            senderName: "",
            text: msg.message ?? "",
            timestamp: new Date(msg.date * 1000),
            isOutgoing: msg.out ?? false,
          };
          _messageCallback?.(message, chatId);
        }
      });
    },

    async disconnect() {
      await client.disconnect();
      setConnectionState("disconnected");
    },

    getConnectionState() {
      return connectionState;
    },

    async getChats() {
      const dialogs = await client.getDialogs({ limit: 100 });
      return dialogs
        .filter((d) => !d.isChannel)
        .map((d) => ({
          id: d.id?.toString() ?? "",
          title: d.title ?? "Unknown",
          unreadCount: d.unreadCount ?? 0,
          isGroup: d.isGroup ?? false,
        }));
    },

    async getMessages(chatId: string, limit = 50) {
      const messages = await client.getMessages(chatId, { limit });
      return messages.map((m) => ({
        id: m.id,
        senderId: m.fromId?.toString() ?? "",
        senderName: "",
        text: m.message ?? "",
        timestamp: new Date(m.date * 1000),
        isOutgoing: m.out ?? false,
      }));
    },

    async sendMessage(chatId: string, text: string) {
      const result = await client.sendMessage(chatId, { message: text });
      return {
        id: result.id,
        senderId: "me",
        senderName: "You",
        text,
        timestamp: new Date(),
        isOutgoing: true,
      };
    },

    onConnectionStateChange(callback) {
      connectionCallback = callback;
    },

    onNewMessage(callback) {
      _messageCallback = callback;
    },
  };
}

export { TelegramClient } from "telegram";
