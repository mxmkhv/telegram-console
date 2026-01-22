import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent } from "telegram/events";
import type { TelegramService, ConnectionState, Message, MediaAttachment } from "../types";

function extractMedia(msg: Api.Message): MediaAttachment | undefined {
  const { media } = msg;
  if (!media) return undefined;

  // Photo
  if (media.className === 'MessageMediaPhoto' && (media as Api.MessageMediaPhoto).photo) {
    const photo = (media as Api.MessageMediaPhoto).photo as Api.Photo;
    const largest = photo.sizes?.slice(-1)[0] as { size?: number; w?: number; h?: number } | undefined;
    return {
      type: 'photo',
      fileSize: largest?.size,
      width: largest?.w,
      height: largest?.h,
      mimeType: 'image/jpeg',
      _message: msg,
    };
  }

  // Document (stickers, GIFs, files)
  if (media.className === 'MessageMediaDocument' && (media as Api.MessageMediaDocument).document) {
    const doc = (media as Api.MessageMediaDocument).document as Api.Document;
    const attrs = doc.attributes || [];

    // Check for sticker
    const stickerAttr = attrs.find(a => a.className === 'DocumentAttributeSticker');
    if (stickerAttr) {
      const isAnimated = doc.mimeType === 'application/x-tgsticker'
                      || doc.mimeType === 'video/webm';
      return {
        type: 'sticker',
        fileSize: Number(doc.size),
        emoji: (stickerAttr as Api.DocumentAttributeSticker).alt,
        isAnimated,
        mimeType: doc.mimeType,
        _message: msg,
      };
    }

    // Check for GIF/animation
    const isAnimated = attrs.some(a => a.className === 'DocumentAttributeAnimated');
    if (isAnimated || doc.mimeType === 'video/mp4') {
      const videoAttr = attrs.find(a => a.className === 'DocumentAttributeVideo') as Api.DocumentAttributeVideo | undefined;
      return {
        type: 'gif',
        fileSize: Number(doc.size),
        width: videoAttr?.w,
        height: videoAttr?.h,
        mimeType: doc.mimeType,
        _message: msg,
      };
    }
  }

  return undefined;
}

export interface TelegramServiceOptions {
  apiId: number | string;
  apiHash: string;
  session?: string;
  onSessionUpdate?: (session: string) => void;
}

export function createTelegramService(options: TelegramServiceOptions): TelegramService & { client: TelegramClient } {
  const { apiId, apiHash, session = "", onSessionUpdate } = options;
  const stringSession = new StringSession(session);
  // @ts-expect-error - GramJS accepts string or number for apiId
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  let connectionState: ConnectionState = "disconnected";
  let connectionCallback: ((state: ConnectionState) => void) | null = null;
  let _messageCallback: ((message: Message, chatId: string) => void) | null = null;
  let eventHandlerAdded = false;

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

      // Only add event handler once to prevent duplicate message dispatches
      if (!eventHandlerAdded) {
        eventHandlerAdded = true;
        client.addEventHandler(
          async (event: NewMessageEvent) => {
            const msg = event.message;
            const chatId = msg.chatId?.toString() ?? "";
            const sender = await msg.getSender() as { firstName?: string; lastName?: string; title?: string; username?: string } | undefined;
            const senderName = sender?.firstName
              ? `${sender.firstName}${sender.lastName ? ` ${sender.lastName}` : ""}`
              : sender?.title ?? sender?.username ?? "Unknown";
            const message: Message = {
              id: msg.id,
              senderId: msg.senderId?.toString() ?? "",
              senderName,
              text: msg.text ?? "",
              timestamp: new Date(msg.date * 1000),
              isOutgoing: msg.out ?? false,
              media: extractMedia(msg),
            };
            _messageCallback?.(message, chatId);
          },
          new NewMessage({})
        );
      }
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

    async getMessages(chatId: string, limit = 50, offsetId?: number) {
      const messages = await client.getMessages(chatId, { limit, offsetId });
      // Reverse to get chronological order (oldest first)
      return messages.map((m) => {
        const sender = m.sender as { firstName?: string; lastName?: string; title?: string; username?: string } | undefined;
        const senderName = sender?.firstName
          ? `${sender.firstName}${sender.lastName ? ` ${sender.lastName}` : ""}`
          : sender?.title ?? sender?.username ?? "Unknown";
        return {
          id: m.id,
          senderId: m.fromId?.toString() ?? "",
          senderName,
          text: m.message ?? "",
          timestamp: new Date(m.date * 1000),
          isOutgoing: m.out ?? false,
          media: extractMedia(m),
        };
      }).reverse();
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

    async downloadMedia(message: Message): Promise<Buffer | undefined> {
      if (!message.media?._message) return undefined;
      const buffer = await client.downloadMedia(message.media._message, {});
      return buffer as Buffer;
    },
  };
}

export { TelegramClient } from "telegram";
