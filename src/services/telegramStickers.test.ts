import { describe, it, expect } from "bun:test";
import { Api, errors, type TelegramClient } from "telegram";
import { returnBigInt as bigInt } from "telegram/Helpers";
import { createStickerStore } from "./telegramStickers";

const sticker = (id: number, alt: string, mimeType = "image/webp", fileReference = "old") =>
  new Api.Document({
    id: bigInt(id),
    accessHash: bigInt(1),
    fileReference: Buffer.from(fileReference),
    date: 0,
    mimeType,
    size: bigInt(1024),
    dcId: 2,
    attributes: [new Api.DocumentAttributeSticker({ alt, stickerset: new Api.InputStickerSetEmpty() })],
  });

const pack = new Api.StickerSet({
  id: bigInt(77),
  accessHash: bigInt(5),
  title: "Cats",
  shortName: "cats",
  count: 2,
  hash: 0,
});

// Answers the sticker requests, and records what was sent
interface FakeOptions {
  /** Sends that fail with an expired file reference before one goes through */
  expireReferences?: number;
  /** Fails a send with this error instead */
  sendError?: string;
  /** What fetching recent stickers does after the first time */
  recentRefetch?: "fail" | "without-sticker-1";
  /** Answers "not modified" for recent stickers */
  notModified?: boolean;
}

function fakeClient({ expireReferences = 0, sendError, recentRefetch, notModified }: FakeOptions = {}) {
  const requests: string[] = [];
  const sent: { file: Api.Document; replyTo?: number }[] = [];
  let fileReference = "old";
  let expiring = expireReferences;
  let recentFetches = 0;
  const client = {
    async invoke(request: Api.AnyRequest) {
      requests.push(request.className);
      if (request instanceof Api.messages.GetAllStickers) return new Api.messages.AllStickers({ hash: bigInt(0), sets: [pack] });
      if (request instanceof Api.messages.GetRecentStickers) {
        if (notModified) return new Api.messages.RecentStickersNotModified();
        if (recentFetches++ > 0 && recentRefetch === "fail") {
          recentRefetch = undefined;
          throw new Error("Not connected");
        }
        if (recentFetches > 1 && recentRefetch === "without-sticker-1") {
          return new Api.messages.RecentStickers({ hash: bigInt(0), packs: [], stickers: [sticker(2, "🔥")], dates: [] });
        }
        return new Api.messages.RecentStickers({
          hash: bigInt(0),
          packs: [],
          stickers: [sticker(1, "😊", "image/webp", fileReference), sticker(2, "🔥", "application/x-tgsticker")],
          dates: [],
        });
      }
      if (request instanceof Api.messages.GetFavedStickers) return new Api.messages.FavedStickers({ hash: bigInt(0), packs: [], stickers: [] });
      if (request instanceof Api.messages.GetStickerSet) {
        return new Api.messages.StickerSet({ set: pack, packs: [], keywords: [], documents: [sticker(3, "🐱")] });
      }
      throw new Error(`Unexpected request ${request.className}`);
    },
    async sendMessage(_chatId: string, params: { file: Api.Document; replyTo?: number }) {
      sent.push(params);
      if (sendError) throw new errors.RPCError(sendError, new Api.messages.SendMedia({} as never), 403);
      if (expiring > 0) {
        expiring--;
        // Telegram hands out a fresh reference with the next fetch
        fileReference = "new";
        throw new errors.RPCError("FILE_REFERENCE_EXPIRED", new Api.messages.SendMedia({} as never), 400);
      }
      return new Api.Message({
        id: 500,
        peerId: new Api.PeerUser({ userId: bigInt(7) }),
        date: 1_700_000_000,
        message: "",
        out: true,
        media: new Api.MessageMediaDocument({ document: params.file }),
      });
    },
  };
  return { client: client as unknown as TelegramClient, requests, sent };
}

describe("sticker store", () => {
  it("lists recent, favorites, then installed packs", async () => {
    const store = createStickerStore(fakeClient().client);
    expect(await store.getStickerSources()).toEqual([
      { kind: "recent", title: "Recent" },
      { kind: "faved", title: "Favorites" },
      { kind: "pack", title: "Cats", id: "77" },
    ]);
  });

  it("reads each sticker's emoji and whether it moves", async () => {
    const store = createStickerStore(fakeClient().client);
    expect(await store.getStickers({ kind: "recent", title: "Recent" })).toEqual([
      { id: "1", emoji: "😊", isAnimated: false },
      { id: "2", emoji: "🔥", isAnimated: true },
    ]);
  });

  it("fetches a pack once, but recent stickers every time", async () => {
    const { client, requests } = fakeClient();
    const store = createStickerStore(client);
    const [, , cats] = await store.getStickerSources();
    await store.getStickers(cats!);
    expect(await store.getStickers(cats!)).toEqual([{ id: "3", emoji: "🐱", isAnimated: false }]);
    await store.getStickers({ kind: "recent", title: "Recent" });
    await store.getStickers({ kind: "recent", title: "Recent" });
    expect(requests.filter((r) => r === "messages.GetStickerSet")).toHaveLength(1);
    expect(requests.filter((r) => r === "messages.GetRecentStickers")).toHaveLength(2);
  });

  it("sends the sticker as a reply, and returns it as a sticker message", async () => {
    const { client, sent } = fakeClient();
    const store = createStickerStore(client);
    const [smile] = await store.getStickers({ kind: "recent", title: "Recent" });
    const message = await store.sendSticker("7", smile!, 42);
    expect(sent[0]!.replyTo).toBe(42);
    expect(sent[0]!.file.id.toString()).toBe("1");
    expect(message).toMatchObject({ id: 500, isOutgoing: true, replyToMsgId: 42, media: { type: "sticker", emoji: "😊" } });
  });

  it("refetches a sticker whose file reference expired, and sends it once more", async () => {
    const { client, sent, requests } = fakeClient({ expireReferences: 1 });
    const store = createStickerStore(client);
    const [smile] = await store.getStickers({ kind: "recent", title: "Recent" });
    expect((await store.sendSticker("7", smile!)).id).toBe(500);
    expect(sent.map((s) => s.file.fileReference.toString())).toEqual(["old", "new"]);
    expect(requests.filter((r) => r === "messages.GetRecentStickers")).toHaveLength(2);
  });

  it("gives up when the fresh reference fails too", async () => {
    const { client, sent } = fakeClient({ expireReferences: 2 });
    const store = createStickerStore(client);
    const [smile] = await store.getStickers({ kind: "recent", title: "Recent" });
    await expect(store.sendSticker("7", smile!)).rejects.toThrow("FILE_REFERENCE_EXPIRED");
    expect(sent).toHaveLength(2);
  });

  it("keeps a sticker sendable when refreshing its reference fails", async () => {
    const { client } = fakeClient({ expireReferences: 1, recentRefetch: "fail" });
    const store = createStickerStore(client);
    const [smile] = await store.getStickers({ kind: "recent", title: "Recent" });
    await expect(store.sendSticker("7", smile!)).rejects.toThrow("Not connected");
    // Retrying from the failed message works once the network's back
    expect((await store.sendSticker("7", smile!)).id).toBe(500);
  });

  it("says so when the sticker is gone from where it came from", async () => {
    const { client } = fakeClient({ expireReferences: 1, recentRefetch: "without-sticker-1" });
    const store = createStickerStore(client);
    const [smile] = await store.getStickers({ kind: "recent", title: "Recent" });
    await expect(store.sendSticker("7", smile!)).rejects.toThrow("This sticker isn't available anymore");
  });

  it("refetches only for an expired reference, not other errors", async () => {
    const { client, sent, requests } = fakeClient({ sendError: "CHAT_SEND_STICKERS_FORBIDDEN" });
    const store = createStickerStore(client);
    const [smile] = await store.getStickers({ kind: "recent", title: "Recent" });
    await expect(store.sendSticker("7", smile!)).rejects.toThrow("CHAT_SEND_STICKERS_FORBIDDEN");
    expect(sent).toHaveLength(1);
    expect(requests.filter((r) => r === "messages.GetRecentStickers")).toHaveLength(1);
  });

  it("fails loudly on a \"not modified\" answer instead of showing nothing", async () => {
    const store = createStickerStore(fakeClient({ notModified: true }).client);
    await expect(store.getStickers({ kind: "recent", title: "Recent" })).rejects.toThrow(
      "Telegram didn't send your recent stickers. Try again",
    );
  });

  it("says so when a sticker wasn't loaded first", async () => {
    const store = createStickerStore(fakeClient().client);
    await expect(store.sendSticker("7", { id: "999", isAnimated: false })).rejects.toThrow(
      "This sticker isn't available anymore. Pick another one",
    );
  });
});
