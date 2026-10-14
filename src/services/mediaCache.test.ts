import { describe, it, expect } from "bun:test";
import { getMediaBuffer } from "./mediaCache";
import { MOCK_STICKER_WEBP } from "./mockSticker";
import type { MediaAttachment } from "../types";

const media = (fileId: string) => ({ type: "sticker", fileId }) as MediaAttachment;

describe("getMediaBuffer", () => {
  it("stores and returns WebP as PNG", async () => {
    let downloads = 0;
    const download = async () => {
      downloads++;
      return MOCK_STICKER_WEBP;
    };
    const sticker = media("document:webp-test");
    const [first, concurrent] = await Promise.all([getMediaBuffer(sticker, download), getMediaBuffer(sticker, download)]);
    const cached = await getMediaBuffer(sticker, download);

    expect(first?.toString("ascii", 1, 4)).toBe("PNG");
    expect(concurrent).toBe(first);
    expect(cached).toBe(first);
    expect(downloads).toBe(1);
  });

  it("doesn't keep a WebP it couldn't convert", async () => {
    const corrupt = Buffer.concat([MOCK_STICKER_WEBP.subarray(0, 12), Buffer.alloc(64)]);
    const sticker = media("document:corrupt-test");
    await expect(getMediaBuffer(sticker, async () => corrupt)).rejects.toThrow("Couldn't decode this WebP image");
    // Tried again rather than failing from the cache
    const retried = await getMediaBuffer(sticker, async () => MOCK_STICKER_WEBP);
    expect(retried?.toString("ascii", 1, 4)).toBe("PNG");
  });

  it("passes other formats through untouched", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(await getMediaBuffer(media("photo:jpeg-test"), async () => jpeg)).toBe(jpeg);
  });
});
