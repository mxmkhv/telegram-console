import { afterEach, describe, it, expect, mock } from "bun:test";
import { render } from "ink-testing-library";
import { Box } from "ink";
import { LOGO_BRAILLE, LOGO_COLS, LOGO_ROWS } from "./logoAssets";
import { ColorModeContext } from "./ui/ColorModeContext";
import { SkinContext } from "./ui/SkinContext";
import type { SkinName } from "../types";

// bun's mock.module is process-wide, so every override must defer to the real
// implementation when unset — otherwise it leaks into test files that run later.
let kittyOverride: boolean | undefined;
let tintOverride: (() => Promise<Buffer>) | undefined;
// Capture the originals: mock.module patches the imported namespace in place, so
// calling through `realKitty.*` inside the mock would call the mock itself.
const realKitty = await import("../services/kittyImage.js");
const { supportsKittyGraphics: realSupports, tintAlphaMask: realTint } = realKitty;
mock.module("../services/kittyImage.js", () => ({
  ...realKitty,
  supportsKittyGraphics: (stream?: NodeJS.WriteStream) => kittyOverride ?? realSupports(stream),
  tintAlphaMask: (png: Buffer, hex: string) => tintOverride?.() ?? realTint(png, hex),
}));

afterEach(() => {
  kittyOverride = undefined;
  tintOverride = undefined;
});

const { Logo } = await import("./Logo");

const PLACEHOLDER = "\u{10EEEE}";
const LOGO_ID_COLOR = "\x1b[38;5;2m";
const TRANSMIT = "\x1b_Ga=p,U=1,i=2,";
const DELETE = "\x1b_Ga=d,d=i,i=2,";

async function waitFor(condition: () => boolean, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("waitFor: condition not met in time");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function LogoWith({ skin = "default", grayscale = false }: { skin?: SkinName; grayscale?: boolean }) {
  return (
    <SkinContext.Provider value={skin}>
      <ColorModeContext.Provider value={grayscale}>
        <Logo />
      </ColorModeContext.Provider>
    </SkinContext.Provider>
  );
}

const count = (frames: string[], needle: string) => frames.filter((f) => f.includes(needle)).length;

describe("Logo", () => {
  it("renders the braille mark when the terminal has no Kitty graphics", () => {
    kittyOverride = false;
    const lines = render(<Logo />).lastFrame()!.split("\n");
    expect(lines).toHaveLength(LOGO_ROWS);
    expect(lines[0]).toBe(LOGO_BRAILLE[0]!.map(([text]) => text).join(""));
  });

  it("transmits under the logo id and draws placeholders that reference it", async () => {
    kittyOverride = true;
    const { lastFrame, stdout, unmount } = render(<Logo />);
    await waitFor(() => lastFrame()!.includes(PLACEHOLDER));

    expect(stdout.frames.find((f) => f.includes(TRANSMIT))).toContain(`c=${LOGO_COLS},r=${LOGO_ROWS}`);
    expect(lastFrame()).toContain(LOGO_ID_COLOR);
    expect(Array.from(lastFrame()!).filter((c) => c === PLACEHOLDER)).toHaveLength(LOGO_COLS * LOGO_ROWS);

    unmount();
    expect(count(stdout.frames, DELETE)).toBe(1);
  });

  it("sends nothing when unmounted before the image is ready", async () => {
    kittyOverride = true;
    const { stdout, unmount } = render(<Logo />);
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(count(stdout.frames, TRANSMIT)).toBe(0);
    expect(count(stdout.frames, DELETE)).toBe(0);
  });

  it("re-tints when the skin changes", async () => {
    kittyOverride = true;
    const { lastFrame, stdout, rerender } = render(<LogoWith skin="default" />);
    await waitFor(() => lastFrame()!.includes(PLACEHOLDER));

    rerender(<LogoWith skin="claudeCode" />);
    await waitFor(() => count(stdout.frames, TRANSMIT) === 2 && lastFrame()!.includes(PLACEHOLDER));
    expect(count(stdout.frames, DELETE)).toBe(1);
  });

  it("does not point placeholders at a deleted image after a grayscale round trip", async () => {
    kittyOverride = true;
    const { lastFrame, stdout, rerender } = render(<LogoWith />);
    await waitFor(() => lastFrame()!.includes(PLACEHOLDER));

    rerender(<LogoWith grayscale />);
    expect(lastFrame()).not.toContain(PLACEHOLDER);
    expect(count(stdout.frames, DELETE)).toBe(1);

    rerender(<LogoWith />);
    expect(lastFrame()).not.toContain(PLACEHOLDER);
    await waitFor(() => count(stdout.frames, TRANSMIT) === 2 && lastFrame()!.includes(PLACEHOLDER));
  });

  it("falls back to braille when the image cannot be prepared", async () => {
    kittyOverride = true;
    tintOverride = () => Promise.reject(new Error("bad tint"));
    const { lastFrame, stdout } = render(<Logo />);
    await waitFor(() => lastFrame()!.includes(LOGO_BRAILLE[0]![0]![0]));
    expect(count(stdout.frames, TRANSMIT)).toBe(0);
  });

  // Each placeholder is one code point plus two combining diacritics. Ink must
  // keep them in one cell (needs @alcalzone/ansi-tokenize >= 0.2.5), or each
  // row spills 2 extra cells per placeholder and erases the border beside it.
  it("keeps the surrounding border intact on image rows", async () => {
    kittyOverride = true;
    const width = LOGO_COLS + 4;
    const { lastFrame } = render(
      <Box borderStyle="round" width={width} flexDirection="column" alignItems="center">
        <Logo />
      </Box>,
    );
    await waitFor(() => lastFrame()!.includes(PLACEHOLDER));

    const lines = lastFrame()!.split("\n");
    expect(lines).toHaveLength(LOGO_ROWS + 2);
    for (const line of lines) {
      expect(Bun.stringWidth(line)).toBe(width);
      expect(Bun.stripANSI(line).at(-1)).toMatch(/[│╮╯]/);
    }
  });

  it("uses braille in grayscale mode even when Kitty is available", () => {
    kittyOverride = true;
    const frame = render(<LogoWith grayscale />).lastFrame()!;
    expect(frame).not.toContain(PLACEHOLDER);
    expect(frame.split("\n")).toHaveLength(LOGO_ROWS);
  });
});
