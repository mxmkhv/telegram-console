import decode, { init } from "@jsquash/webp/decode.js";
import { Jimp } from "jimp";
import { loadWebpWasm } from "./webpWasm.js";

// Telegram serves stickers, and the preview frames of animated ones, as WebP.
// Jimp and terminal-image can't decode it, so it becomes PNG first.

let decoderReady: Promise<void> | undefined;

function initDecoder(): Promise<void> {
  decoderReady ??= WebAssembly.compile(loadWebpWasm()).then((module) => init(module));
  return decoderReady;
}

/** By its bytes: an animated sticker's mime type doesn't describe its WebP preview frame */
export function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

export async function webpToPng(buffer: Buffer): Promise<Buffer> {
  await initDecoder();
  // A copy: a Buffer can be a slice of a larger shared pool, which decode would read whole
  const { data, width, height } = await decode(new Uint8Array(buffer).buffer);
  const image = Jimp.fromBitmap({ data: Buffer.from(data.buffer, data.byteOffset, data.byteLength), width, height });
  return image.getBuffer("image/png");
}
