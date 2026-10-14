import { describe, it, expect } from "bun:test";
import { Jimp } from "jimp";
import terminalImage from "terminal-image";
import { isWebp, webpToPng } from "./webp";
import { MOCK_STICKER_WEBP } from "./mockSticker";
import { buildKittyImage } from "./kittyImage";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("isWebp", () => {
  it("recognises WebP by its bytes", () => {
    expect(isWebp(MOCK_STICKER_WEBP)).toBe(true);
  });

  it("rejects other formats and short buffers", () => {
    expect(isWebp(PNG_SIGNATURE)).toBe(false);
    expect(isWebp(Buffer.from("RIFF"))).toBe(false);
    // A RIFF container that isn't WebP (WAV)
    expect(isWebp(Buffer.from("RIFF\0\0\0\0WAVEfmt "))).toBe(false);
  });
});

describe("webpToPng", () => {
  it("keeps size and transparency", async () => {
    const png = await webpToPng(MOCK_STICKER_WEBP);
    expect(png.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);

    const image = await Jimp.fromBuffer(png);
    expect(image.width).toBe(128);
    expect(image.height).toBe(128);
    // Outside the circle is transparent, inside opaque
    expect(image.getPixelColor(0, 0) & 0xff).toBe(0);
    expect(image.getPixelColor(64, 30) & 0xff).toBe(0xff);
  });

  it("decodes a WebP that sits inside a larger buffer", async () => {
    const pooled = Buffer.concat([Buffer.from("junk before"), MOCK_STICKER_WEBP, Buffer.from("junk after")]);
    const slice = pooled.subarray(11, 11 + MOCK_STICKER_WEBP.length);
    const image = await Jimp.fromBuffer(await webpToPng(slice));
    expect(image.width).toBe(128);
  });

  it("fails loudly on corrupt data", async () => {
    const corrupt = Buffer.concat([MOCK_STICKER_WEBP.subarray(0, 12), Buffer.alloc(64)]);
    expect(webpToPng(corrupt)).rejects.toThrow();
  });

  it("produces something both renderers draw", async () => {
    const png = await webpToPng(MOCK_STICKER_WEBP);
    const kitty = await buildKittyImage(png, 20, 10);
    expect(kitty.viewCols).toBe(20);
    const ansi = await terminalImage.buffer(png, { width: 20, preferNativeRender: false });
    expect(ansi.length).toBeGreaterThan(0);
  });
});
