import { Jimp } from "jimp";
import { createSupportsTerminalGraphics } from "supports-terminal-graphics";
import { DIACRITICS } from "./kittyDiacritics.js";

// Kitty graphics protocol — Unicode placeholder rendering.
//
// Why placeholders (not direct placement): the image is emitted as ordinary
// *text* (a grid of U+10EEEE placeholder chars colored with the image id), so it
// lives inside Ink's <Text> and survives Ink's frame redraws without re-blitting
// or absolute cursor positioning. Callers own their fallback for terminals
// without support: MediaPanel uses ANSI half-blocks, Logo uses braille.

const ESC = "\x1b";
const PLACEHOLDER = "\u{10EEEE}";

// Each id holds one image; re-sending under an id replaces its image. Two
// mounted users of the same id would overwrite each other, and the first to
// unmount would delete the image for both.
export const MEDIA_IMAGE_ID = 1;
export const LOGO_IMAGE_ID = 2;

// Detection is env-based (see supports-terminal-graphics). Inside tmux the outer
// terminal's env leaks through, but tmux drops unwrapped graphics sequences, so
// trusting it would draw nothing instead of falling back.
export function supportsKittyGraphics(stream: NodeJS.WriteStream = process.stdout): boolean {
  if (process.env.TMUX) return false;
  return !!createSupportsTerminalGraphics(stream).kitty;
}

export interface KittyImage {
  /** Escape string to write directly to stdout: uploads the image + creates the virtual placement. */
  control: string;
  /** Zoomed placement size in cells — the full image spans this grid. */
  placementCols: number;
  placementRows: number;
  /** Viewport (fit) size in cells — the window of the placement shown on screen. */
  viewCols: number;
  viewRows: number;
}

// Convert an arbitrary media buffer (jpg/png/…) to PNG, downscale for transmission
// speed, and size a placement to fit contentWidth x maxRows cells, magnified by
// `zoom`. The image spans placementCols x placementRows cells; only a viewCols x
// viewRows window is shown at a time (see placeholderGridWindow) so zoom > 1 can
// be panned.
export async function buildKittyImage(
  buffer: Buffer,
  contentWidth: number,
  maxRows: number,
  zoom = 1,
): Promise<KittyImage> {
  const img = await Jimp.fromBuffer(buffer);
  if (img.bitmap.width > 1024) img.resize({ w: 1024 });
  const png = (await img.getBuffer("image/png")) as Buffer;

  const maxCells = DIACRITICS.length;
  // Fit (viewport) dims. Terminal cells are ~1:2 (w:h), so halve to preserve aspect.
  const viewCols = Math.max(1, Math.min(contentWidth, maxCells));
  const aspectRows = Math.round(viewCols * (img.bitmap.height / img.bitmap.width) * 0.5);
  const viewRows = Math.max(1, Math.min(aspectRows, maxRows, maxCells));

  // Zoomed placement dims, clamped to the diacritic budget (297).
  const placementCols = Math.max(viewCols, Math.min(Math.round(viewCols * zoom), maxCells));
  const placementRows = Math.max(viewRows, Math.min(Math.round(viewRows * zoom), maxCells));

  return {
    control: transmitAndPlace(png, placementCols, placementRows),
    placementCols,
    placementRows,
    viewCols,
    viewRows,
  };
}

// Recolor a white-on-transparent mask PNG to `hex` (e.g. "#2AABEE"), keeping its
// alpha — lets one embedded asset follow the active skin's accent color.
export async function tintAlphaMask(png: Buffer, hex: string): Promise<Buffer> {
  if (!/^#?[0-9a-f]{6}$/i.test(hex)) throw new Error(`tintAlphaMask expects a #rrggbb color, got "${hex}"`);
  const rgb = Number.parseInt(hex.replace("#", ""), 16);
  const img = await Jimp.fromBuffer(png);
  const data = img.bitmap.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (rgb >> 16) & 0xff;
    data[i + 1] = (rgb >> 8) & 0xff;
    data[i + 2] = rgb & 0xff;
  }
  return (await img.getBuffer("image/png")) as Buffer;
}

// Delete the image's placements (d=i) so nothing ghosts after its owner unmounts.
// The image data stays cached under the id until the id is reused.
export function clearKittyImage(imageId = MEDIA_IMAGE_ID): string {
  return `${ESC}_Ga=d,d=i,i=${imageId},q=2${ESC}\\`;
}

// Two-step per spec: (1) transmit data only (a=t, no placement), then
// (2) create a virtual placement (a=p, U=1) sized cols x rows.
export function transmitAndPlace(png: Buffer, cols: number, rows: number, imageId = MEDIA_IMAGE_ID): string {
  const b64 = png.toString("base64");
  const chunkSize = 4096;
  const total = Math.max(1, Math.ceil(b64.length / chunkSize));
  let out = "";
  for (let i = 0; i < total; i++) {
    const chunk = b64.slice(i * chunkSize, (i + 1) * chunkSize);
    const more = i === total - 1 ? 0 : 1;
    out += i === 0
      ? `${ESC}_Gi=${imageId},a=t,f=100,t=d,q=2,m=${more};${chunk}${ESC}\\`
      : `${ESC}_Gm=${more};${chunk}${ESC}\\`;
  }
  out += `${ESC}_Ga=p,U=1,i=${imageId},c=${cols},r=${rows},q=2${ESC}\\`;
  return out;
}

// A winW x winH window of placeholder cells over a totalCols x totalRows
// placement, offset by (offX, offY). Each cell carries its *absolute* row/col
// diacritic, so the terminal paints exactly that sub-region of the image — this
// is what makes panning work without re-transmitting the image. The offset is
// clamped so the window stays within the placement. Image id is carried in the
// foreground color (256-indexed for id <= 255).
export function placeholderGridWindow(
  totalCols: number,
  totalRows: number,
  offX: number,
  offY: number,
  winW: number,
  winH: number,
  imageId = MEDIA_IMAGE_ID,
): string {
  const setColor = imageId <= 255
    ? `${ESC}[38;5;${imageId}m`
    : `${ESC}[38;2;${(imageId >> 16) & 0xff};${(imageId >> 8) & 0xff};${imageId & 0xff}m`;
  const reset = `${ESC}[39m`;
  const cols = Math.max(0, Math.min(winW, totalCols));
  const rows = Math.max(0, Math.min(winH, totalRows));
  const clampedOffX = Math.max(0, Math.min(offX, totalCols - cols));
  const clampedOffY = Math.max(0, Math.min(offY, totalRows - rows));
  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    const rowDia = String.fromCodePoint(DIACRITICS[clampedOffY + row]!);
    let line = setColor;
    for (let col = 0; col < cols; col++) {
      line += PLACEHOLDER + rowDia + String.fromCodePoint(DIACRITICS[clampedOffX + col]!);
    }
    lines.push(line + reset);
  }
  return lines.join("\n");
}
