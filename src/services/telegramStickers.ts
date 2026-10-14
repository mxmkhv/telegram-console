import { Api, errors, type TelegramClient } from "telegram";
import { returnBigInt } from "telegram/Helpers";
import { documentAttribute, extractMedia, isAnimatedSticker } from "./telegramMessage";
import type { Message, Sticker, StickerSource, TelegramService } from "../types";

// Telegram lets a file reference go stale after a while; refetching the sticker gets a new one
function isFileReferenceExpired(err: unknown): boolean {
  return err instanceof errors.RPCError && /^FILE_REFERENCE_(\d+_)?EXPIRED$/.test(err.errorMessage);
}

function expectResult<T>(result: unknown, type: new (...args: never[]) => T, what: string): T {
  if (result instanceof type) return result;
  throw new Error(`Telegram didn't send ${what}. Try again`);
}

type StickerStore = Pick<TelegramService, "getStickerSources" | "getStickers" | "sendSticker">;

export function createStickerStore(client: TelegramClient): StickerStore {
  // Sending needs the whole document, and refreshing a stale one needs where it came from
  const known = new Map<string, { document: Api.Document; source: StickerSource }>();
  const packs = new Map<string, Api.StickerSet>();
  // Packs rarely change, so each is fetched once a session; recent and favorites change with use
  const packStickers = new Map<string, Sticker[]>();

  // A hash of 0 asks for the full list. "Not modified" shouldn't come back, but
  // if it does, it's an error: shown as an empty pack, it would stick for the session.
  async function fetchDocuments(source: StickerSource): Promise<Api.TypeDocument[]> {
    switch (source.kind) {
      case "recent": {
        const result = await client.invoke(new Api.messages.GetRecentStickers({ hash: returnBigInt(0) }));
        return expectResult(result, Api.messages.RecentStickers, "your recent stickers").stickers;
      }
      case "faved": {
        const result = await client.invoke(new Api.messages.GetFavedStickers({ hash: returnBigInt(0) }));
        return expectResult(result, Api.messages.FavedStickers, "your favorite stickers").stickers;
      }
      case "pack": {
        const pack = packs.get(source.id);
        if (!pack) throw new Error(`The pack "${source.title}" isn't installed anymore. Reopen the sticker picker`);
        const stickerset = new Api.InputStickerSetID({ id: pack.id, accessHash: pack.accessHash });
        const result = await client.invoke(new Api.messages.GetStickerSet({ stickerset, hash: 0 }));
        return expectResult(result, Api.messages.StickerSet, `the pack "${source.title}"`).documents;
      }
    }
  }

  async function load(source: StickerSource): Promise<Sticker[]> {
    const stickers = (await fetchDocuments(source)).flatMap((document) => {
      if (!(document instanceof Api.Document)) return [];
      const id = document.id.toString();
      known.set(id, { document, source });
      const emoji = documentAttribute(document, Api.DocumentAttributeSticker)?.alt || undefined;
      return [{ id, emoji, isAnimated: isAnimatedSticker(document) }];
    });
    if (source.kind === "pack") packStickers.set(source.id, stickers);
    return stickers;
  }

  return {
    async getStickerSources() {
      const result = await client.invoke(new Api.messages.GetAllStickers({ hash: returnBigInt(0) }));
      const sets = expectResult(result, Api.messages.AllStickers, "your sticker packs").sets;
      for (const set of sets) packs.set(set.id.toString(), set);
      return [
        { kind: "recent", title: "Recent" },
        { kind: "faved", title: "Favorites" },
        ...sets.map((set): StickerSource => ({ kind: "pack", title: set.title, id: set.id.toString() })),
      ];
    },

    async getStickers(source) {
      return (source.kind === "pack" && packStickers.get(source.id)) || load(source);
    },

    async sendSticker(chatId, sticker, replyToMsgId, replyToSenderName) {
      const send = () => {
        const entry = known.get(sticker.id);
        if (!entry) throw new Error("This sticker isn't available anymore. Pick another one");
        return client.sendMessage(chatId, { file: entry.document, ...(replyToMsgId && { replyTo: replyToMsgId }) });
      };
      let result: Api.Message;
      try {
        result = await send();
      } catch (err) {
        const source = known.get(sticker.id)?.source;
        if (!source || !isFileReferenceExpired(err)) throw err;
        // A failed refetch keeps the old entry, so a retry can try again
        const fresh = await load(source);
        // Gone from its source by now (dropped from recent, say): send() says so
        if (!fresh.some((s) => s.id === sticker.id)) known.delete(sticker.id);
        result = await send();
      }
      const message: Message = {
        id: result.id,
        senderId: "me",
        senderName: "You",
        text: "",
        timestamp: new Date(),
        isOutgoing: true,
        media: extractMedia(result),
        replyToMsgId,
        replyToSenderName,
      };
      return message;
    },
  };
}
