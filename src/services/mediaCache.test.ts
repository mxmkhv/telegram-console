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

  it("passes other formats through untouched", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(await getMediaBuffer(media("photo:jpeg-test"), async () => jpeg)).toBe(jpeg);
  });
});
