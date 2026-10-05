import { describe, it, expect, mock } from "bun:test";
import { render } from "ink-testing-library";
import { Box } from "ink";
import { LOGO_BRAILLE, LOGO_COLS, LOGO_ROWS } from "./logoAssets";
import { ColorModeContext } from "./ui/ColorModeContext";

let kittySupported = false;
const realKitty = await import("../services/kittyImage.js");
mock.module("../services/kittyImage.js", () => ({
  ...realKitty,
  supportsKittyGraphics: () => kittySupported,
}));

const { Logo } = await import("./Logo");

const PLACEHOLDER = "\u{10EEEE}";
const waitForEffects = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("Logo", () => {
  it("renders the braille mark when the terminal has no Kitty graphics", () => {
    kittySupported = false;
    const frame = render(<Logo />).lastFrame()!;
    const lines = frame.split("\n");
    expect(lines).toHaveLength(LOGO_ROWS);
    expect(lines[0]).toBe(LOGO_BRAILLE[0]!.map(([text]) => text).join(""));
  });

  it("transmits the image under the logo id and draws placeholder cells", async () => {
    kittySupported = true;
    const { lastFrame, stdout, unmount } = render(<Logo />);
    await waitForEffects();

    const transmit = stdout.frames.find((f) => f.includes("\x1b_Ga=p,U=1,i=2,"));
    expect(transmit).toContain(`c=${LOGO_COLS},r=${LOGO_ROWS}`);
    const cells = Array.from(lastFrame()!).filter((c) => c === PLACEHOLDER);
    expect(cells).toHaveLength(LOGO_COLS * LOGO_ROWS);

    unmount();
    expect(stdout.frames.some((f) => f.includes("\x1b_Ga=d,d=i,i=2,"))).toBe(true);
  });

  // Each placeholder is one code point plus two combining diacritics. Ink must
  // keep them in one cell (needs @alcalzone/ansi-tokenize >= 0.2.5), or each
  // row spills 2 extra cells per placeholder and erases the border beside it.
  it("keeps the surrounding border intact on image rows", async () => {
    kittySupported = true;
    const width = LOGO_COLS + 4;
    const { lastFrame } = render(
      <Box borderStyle="round" width={width} flexDirection="column" alignItems="center">
        <Logo />
      </Box>,
    );
    await waitForEffects();

    const lines = lastFrame()!.split("\n");
    expect(lines).toHaveLength(LOGO_ROWS + 2);
    for (const line of lines) {
      expect(Bun.stringWidth(line)).toBe(width);
      expect(Bun.stripANSI(line).at(-1)).toMatch(/[│╮╯]/);
    }
  });

  it("uses braille in grayscale mode even when Kitty is available", () => {
    kittySupported = true;
    const frame = render(
      <ColorModeContext.Provider value={true}>
        <Logo />
      </ColorModeContext.Provider>,
    ).lastFrame()!;
    expect(frame).not.toContain(PLACEHOLDER);
    expect(frame.split("\n")).toHaveLength(LOGO_ROWS);
  });
});
