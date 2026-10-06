import { TelegramClient, Api, utils } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent, Raw } from "telegram/events";
import type { TelegramService, ConnectionState, Message, MediaAttachment } from "../types";

// Type for sender objects from GramJS (User, Chat, or Channel)
interface GramJSSender {
  firstName?: string;
  lastName?: string;
  title?: string;
  username?: string;
}

function formatSenderName(sender: GramJSSender | undefined): string {
  if (!sender) return "Unknown";
  if (sender.firstName) {
    return `${sender.firstName}${sender.lastName ? ` ${sender.lastName}` : ""}`;
  }
  return sender.title ?? sender.username ?? "Unknown";
}

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

    // Check for voice message
    const audioAttr = attrs.find(a => a.className === 'DocumentAttributeAudio') as Api.DocumentAttributeAudio | undefined;
    if (audioAttr?.voice) {
      return {
        type: 'voice',
        fileSize: Number(doc.size),
        duration: audioAttr.duration,
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractMessageText(m: Api.Message): string {
  // Service messages (phone calls, etc.) have an action but no text
  const action = (m as unknown as { action?: { className?: string; duration?: number; reason?: { className?: string }; video?: boolean } }).action;
  if (action?.className === "MessageActionPhoneCall") {
    const callType = action.video ? "video call" : "call";
    if (action.reason?.className === "PhoneCallDiscardReasonMissed") {
      return `Missed ${callType}`;
    }
    if (action.reason?.className === "PhoneCallDiscardReasonBusy") {
      return `Declined ${callType}`;
    }
    if (action.duration) {
      const mins = Math.floor(action.duration / 60);
      const secs = action.duration % 60;
      const dur = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      return `${capitalize(callType)} (${dur})`;
    }
    return capitalize(callType);
  }
  return m.message ?? m.text ?? "";
}

function extractReactions(msg: Api.Message): Message["reactions"] {
  const reactions = msg.reactions;
  if (!reactions?.results) return undefined;

  return reactions.results
    .filter((r): r is Api.ReactionCount & { reaction: Api.ReactionEmoji } =>
      r.reaction?.className === "ReactionEmoji"
    )
    .map((r) => ({
      emoji: r.reaction.emoticon,
      count: r.count,
      // chosenOrder is null when user hasn't reacted, number when they have
      hasUserReacted: r.chosenOrder != null,
    }));
}

function toMessage(m: Api.Message, sender: GramJSSender | undefined): Message {
  return {
    id: m.id,
    senderId: m.senderId?.toString() ?? "",
    senderName: formatSenderName(sender),
    text: extractMessageText(m),
    timestamp: new Date(m.date * 1000),
    isOutgoing: m.out ?? false,
    media: extractMedia(m),
    reactions: extractReactions(m),
  };
}

const TYPING_TIMEOUT_MS = 6000;

// True for any "actively composing" action we surface as generic "typing…".
// SendMessageCancelAction (an explicit stop) and unknown actions return false.
function isActiveTypingAction(action: Api.TypeSendMessageAction | undefined): boolean {
  if (!action) return false;
  return action.className !== "SendMessageCancelAction";
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
  const numericApiId = typeof apiId === "string" ? parseInt(apiId, 10) : apiId;
  const client = new TelegramClient(stringSession, numericApiId, apiHash, {
    connectionRetries: 5,
  });

  // Disable GramJS logging
  client.setLogLevel("none" as never);

  let connectionState: ConnectionState = "disconnected";
  let connectionCallback: ((state: ConnectionState) => void) | null = null;
  const _messageCallbacks = new Set<(message: Message, chatId: string) => void>();
  let eventHandlerAdded = false;
  const _typingCallbacks = new Set<(chatId: string, isTyping: boolean) => void>();
  const _typingTimers = new Map<string, NodeJS.Timeout>();

  function emitTyping(chatId: string, isTyping: boolean) {
    _typingCallbacks.forEach((cb) => cb(chatId, isTyping));
  }

  function clearTypingTimer(chatId: string) {
    const existing = _typingTimers.get(chatId);
    if (existing) {
      clearTimeout(existing);
      _typingTimers.delete(chatId);
    }
  }

  // Resolve the raw update's peer to the same marked id getChats()/msg.chatId use.
  function resolveTypingChatId(update: Api.TypeUpdate): string | null {
    if (update instanceof Api.UpdateUserTyping) {
      return utils.getPeerId(new Api.PeerUser({ userId: update.userId })).toString();
    }
    if (update instanceof Api.UpdateChatUserTyping) {
      return utils.getPeerId(new Api.PeerChat({ chatId: update.chatId })).toString();
    }
    if (update instanceof Api.UpdateChannelUserTyping) {
      return utils.getPeerId(new Api.PeerChannel({ channelId: update.channelId })).toString();
    }
    return null;
  }

  function setConnectionState(state: ConnectionState) {
    connectionState = state;
    connectionCallback?.(state);
  }

  return {
    client,

    async connect() {
      setConnectionState("connecting");
      // GramJS resolves false (instead of throwing) once its retries run out,
      // and also when already connected
      let connected: boolean;
      try {
        connected = (await client.connect()) || !!client.connected;
      } catch (err) {
        setConnectionState("disconnected");
        throw err;
      }
      if (!connected) {
        setConnectionState("disconnected");
        throw new Error("Couldn't reach Telegram servers. Check your network connection");
      }
      setConnectionState("connected");
      onSessionUpdate?.(String(client.session.save()));

      // Only add event handler once to prevent duplicate message dispatches
      if (!eventHandlerAdded) {
        eventHandlerAdded = true;
        client.addEventHandler(
          async (event: NewMessageEvent) => {
            const msg = event.message;
            const chatId = msg.chatId?.toString() ?? "";
            const sender = (await msg.getSender()) as GramJSSender | undefined;
            const message = toMessage(msg, sender);
            _messageCallbacks.forEach(cb => cb(message, chatId));
          },
          new NewMessage({})
        );

        client.addEventHandler((update: Api.TypeUpdate) => {
          const isTypingUpdate =
            update instanceof Api.UpdateUserTyping ||
            update instanceof Api.UpdateChatUserTyping ||
            update instanceof Api.UpdateChannelUserTyping;
          if (!isTypingUpdate) return;

          const chatId = resolveTypingChatId(update);
          if (!chatId) return;

          const action = (update as Api.UpdateUserTyping | Api.UpdateChatUserTyping | Api.UpdateChannelUserTyping).action;
          if (!isActiveTypingAction(action)) {
            // explicit cancel: clear immediately
            clearTypingTimer(chatId);
            emitTyping(chatId, false);
            return;
          }

          emitTyping(chatId, true);
          clearTypingTimer(chatId);
          _typingTimers.set(
            chatId,
            setTimeout(() => {
              _typingTimers.delete(chatId);
              emitTyping(chatId, false);
            }, TYPING_TIMEOUT_MS),
          );
        }, new Raw({}));
      }
    },

    async disconnect() {
      _typingTimers.forEach((timer) => clearTimeout(timer));
      _typingTimers.clear();
      await client.disconnect();
      setConnectionState("disconnected");
    },

    getConnectionState() {
      return connectionState;
    },

    async getChats() {
      const dialogs = await client.getDialogs({ limit: 100 });
      return dialogs
        // Keep DMs and groups (regular + supergroups); drop only broadcast
        // channels. In GramJS, isChannel is true for supergroups too, so
        // filtering on !isChannel would wrongly hide every supergroup.
        .filter((d) => d.isUser || d.isGroup)
        .map((d) => ({
          id: d.id?.toString() ?? "",
          title: d.title ?? "Unknown",
          unreadCount: d.unreadCount ?? 0,
          isGroup: d.isGroup ?? false,
          // getDialogs attaches each message's sender, so this needs no extra request
          // MessageEmpty has no date (or anything else worth previewing)
          lastMessage: d.message?.date ? toMessage(d.message, d.message.sender as GramJSSender | undefined) : undefined,
        }));
    },

    async getMessages(chatId: string, limit = 50, offsetId?: number) {
      const rawMessages = await client.getMessages(chatId, { limit, offsetId });

      // Build a map of message IDs to sender names for reply resolution
      const msgIdToSender = new Map<number, string>();
      for (const m of rawMessages) {
        msgIdToSender.set(m.id, formatSenderName(m.sender as GramJSSender | undefined));
      }

      // Reverse to get chronological order (oldest first)
      return rawMessages.map((m) => ({
        ...toMessage(m, m.sender as GramJSSender | undefined),
        replyToMsgId: m.replyTo?.replyToMsgId,
        replyToSenderName: m.replyTo?.replyToMsgId
          ? msgIdToSender.get(m.replyTo.replyToMsgId) ?? "Unknown"
          : undefined,
      })).reverse();
    },

    async sendMessage(chatId: string, text: string, replyToMsgId?: number, replyToSenderName?: string) {
      const result = await client.sendMessage(chatId, {
        message: text,
        ...(replyToMsgId && { replyTo: replyToMsgId }),
      });
      return {
        id: result.id,
        senderId: "me",
        senderName: "You",
        text,
        timestamp: new Date(),
        isOutgoing: true,
        replyToMsgId,
        replyToSenderName,
      };
    },

    async sendImage(chatId: string, filePath: string) {
      // GramJS auto-detects images and sends them as photos. The returned
      // Api.Message carries the uploaded media, so we reuse extractMedia() to
      // render it exactly like a received photo.
      const result = await client.sendMessage(chatId, { file: filePath });
      return {
        id: result.id,
        senderId: "me",
        senderName: "You",
        text: result.message ?? "",
        timestamp: new Date(),
        isOutgoing: true,
        media: extractMedia(result),
      };
    },

    async editMessage(chatId: string, messageId: number, newText: string) {
      await client.invoke(
        new Api.messages.EditMessage({
          peer: chatId,
          id: messageId,
          message: newText,
        })
      );
      return {
        id: messageId,
        senderId: "me",
        senderName: "You",
        text: newText,
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
      _messageCallbacks.add(callback);
      return () => {
        _messageCallbacks.delete(callback);
      };
    },

    onTyping(callback) {
      _typingCallbacks.add(callback);
      return () => {
        _typingCallbacks.delete(callback);
      };
    },

    async downloadMedia(message: Message): Promise<Buffer | undefined> {
      if (!message.media?._message) return undefined;
      const buffer = await client.downloadMedia(message.media._message, {});
      return buffer as Buffer;
    },

    async markAsRead(chatId: string, maxMessageId?: number): Promise<boolean> {
      try {
        return await client.markAsRead(chatId, maxMessageId ? [maxMessageId] : undefined);
      } catch {
        return false;
      }
    },

    async sendReaction(chatId: string, messageId: number, emoji: string): Promise<boolean> {
      try {
        await client.invoke(
          new Api.messages.SendReaction({
            peer: chatId,
            msgId: messageId,
            reaction: [new Api.ReactionEmoji({ emoticon: emoji })],
          })
        );
        return true;
      } catch {
        return false;
      }
    },

    async removeReaction(chatId: string, messageId: number): Promise<boolean> {
      try {
        await client.invoke(
          new Api.messages.SendReaction({
            peer: chatId,
            msgId: messageId,
            reaction: [],
          })
        );
        return true;
      } catch {
        return false;
      }
    },
  };
}

export { TelegramClient } from "telegram";
