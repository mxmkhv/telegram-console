import { TelegramClient, Api, utils } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent, Raw } from "telegram/events";
import { EditedMessage, type EditedMessageEvent } from "telegram/events/EditedMessage";
import { DeletedMessage, type DeletedMessageEvent } from "telegram/events/DeletedMessage";
import { UpdateConnectionState } from "telegram/network";
import { createConnectionWatchdog, readConnectionReport } from "./connectionWatchdog";
import { extractMedia, extractReactions, toMessage, type GramJSSender } from "./telegramMessage";
import { createListeners } from "../utils/listeners";
import { needsPreviewFrame } from "../utils/media";
import type { TelegramService, ConnectionState, Message, ReportedReaction } from "../types";

// Muted until a time still ahead (forever is a far-off date). A chat that
// follows the account's default for its type isn't marked, even if that mutes it.
function isMuted(dialog: Api.TypeDialog | undefined): boolean {
  if (!(dialog instanceof Api.Dialog)) return false;
  const muteUntil = dialog.notifySettings.muteUntil;
  return muteUntil !== undefined && muteUntil * 1000 > Date.now();
}

// The largest still image of a video or animated sticker
function previewFrame(msg: Api.Message): Api.TypePhotoSize | undefined {
  const doc = msg.media instanceof Api.MessageMediaDocument ? msg.media.document : undefined;
  if (!(doc instanceof Api.Document)) return undefined;
  const sizes = (doc.thumbs ?? []).filter((t) => t instanceof Api.PhotoSize || t instanceof Api.PhotoSizeProgressive);
  const largest = sizes.sort((a, b) => a.w * a.h - b.w * b.h).at(-1);
  // A blurry inline one beats nothing
  return largest ?? doc.thumbs?.find((t) => t instanceof Api.PhotoStrippedSize);
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
  const edits = createListeners<[Message, string]>();
  const deletions = createListeners<[number[], string | undefined]>();
  const reactionChanges = createListeners<[string, number, ReportedReaction[]]>();

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

  // Set while we disconnect on purpose, so the drop isn't treated as one
  let disconnecting = false;
  const watchdog = createConnectionWatchdog({
    async reconnect() {
      if (disconnecting) return false;
      const connected = (await client.connect()) || !!client.connected;
      // Logged out while that was in flight: don't leave a live connection behind
      if (disconnecting) {
        await client.disconnect();
        return false;
      }
      return connected;
    },
    // GramJS is still retrying on its own
    isRecovering: () => !!client._sender?.isReconnecting,
    onStateChange: setConnectionState,
  });

  return {
    client,

    async connect() {
      disconnecting = false;
      setConnectionState("connecting");
      // GramJS resolves false (instead of throwing) once its retries run out,
      // and also when already connected
      try {
        const connected = (await client.connect()) || !!client.connected;
        if (!connected) {
          throw new Error("Couldn't reach Telegram servers. Check your network connection");
        }
        // GramJS looks up the account before dispatching each update until it
        // has it. Fetch it now, or a drop reported before any other update
        // would wait for the network it just lost.
        await client.getMe(true);
      } catch (err) {
        setConnectionState("disconnected");
        throw err;
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

        client.addEventHandler(
          async (event: EditedMessageEvent) => {
            const msg = event.message;
            const sender = (await msg.getSender()) as GramJSSender | undefined;
            edits.emit(toMessage(msg, sender), msg.chatId?.toString() ?? "");
          },
          new EditedMessage({}),
        );

        client.addEventHandler((event: DeletedMessageEvent) => {
          // Only channels and supergroups say where
          const chatId = event.peer ? utils.getPeerId(event.peer).toString() : undefined;
          deletions.emit(event.deletedIds, chatId);
        }, new DeletedMessage({}));

        client.addEventHandler(
          (update: Api.UpdateMessageReactions) => {
            const reactions = extractReactions(update.reactions) ?? [];
            reactionChanges.emit(utils.getPeerId(update.peer).toString(), update.msgId, reactions);
          },
          new Raw({ types: [Api.UpdateMessageReactions] }),
        );

        // GramJS reports drops it notices (failed pings, closed sockets, waking
        // from sleep) and when it gets the connection back
        client.addEventHandler(
          (update: UpdateConnectionState) => {
            if (disconnecting) return;
            const report = readConnectionReport(update.state === UpdateConnectionState.connected, {
              wasConnected: connectionState === "connected",
              reconnecting: !!client._sender?.isReconnecting,
              connected: !!client.connected,
            });
            if (report === "restored") watchdog.restored();
            else if (report === "lost") watchdog.lost();
          },
          new Raw({ types: [UpdateConnectionState] }),
        );
      }
    },

    async disconnect() {
      disconnecting = true;
      watchdog.stop();
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
          isMuted: isMuted(d.dialog),
          // getDialogs attaches each message's sender, so this needs no extra request
          // MessageEmpty has no date (or anything else worth previewing)
          lastMessage: d.message?.date ? toMessage(d.message, d.message.sender as GramJSSender | undefined) : undefined,
        }));
    },

    async getMessages(chatId: string, limit = 50, offsetId?: number) {
      const rawMessages = await client.getMessages(chatId, { limit, offsetId });
      // Reverse to get chronological order (oldest first)
      return rawMessages.map((m) => toMessage(m, m.sender as GramJSSender | undefined)).reverse();
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

    onMessageEdited: edits.subscribe,
    onMessagesDeleted: deletions.subscribe,
    onReactionsChanged: reactionChanges.subscribe,

    onTyping(callback) {
      _typingCallbacks.add(callback);
      return () => {
        _typingCallbacks.delete(callback);
      };
    },

    async downloadMedia(message: Message): Promise<Buffer | undefined> {
      const media = message.media;
      if (!media?._message) return undefined;
      if (needsPreviewFrame(media)) {
        const frame = previewFrame(media._message);
        if (!frame) throw new Error("No preview image to show for this one");
        return (await client.downloadMedia(media._message, { thumb: frame })) as Buffer;
      }
      return (await client.downloadMedia(media._message, {})) as Buffer;
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
