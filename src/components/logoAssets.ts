// Generated from logo.svg (viewBox cropped to the mark: 5 1.5 36 23). Do not edit by hand.

export const LOGO_COLS = 28;
export const LOGO_ROWS = 9;

// Braille rendition, one entry per terminal row as [text, dim] runs: the outline
// is bright, the center fold and cursor are dim (they are 55% opacity in logo.svg).
export const LOGO_BRAILLE: ReadonlyArray<ReadonlyArray<readonly [text: string, dim: boolean]>> = [
  [["⢠⣶⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀", false]],
  [["⠀⠹⣿⣿⣿⣶⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀", false]],
  [["⠀⠀⠘⢿⣷⡉⠛⠿⣿⣶⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀", false]],
  [["⠀⠀⠀⠈⢻⣿⣄⠀⠀⠉⠛⠿⣿⣶⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀", false]],
  [["⠀⠀⠀⠀⠀⣹⣿⣿", false], ["⣿⣿⣿⣿⣿", true], ["⣿⣿⣿⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀", false]],
  [["⠀⠀⠀⢀⣼⣿⠋⠀⠀⣀⣤⣶⣿⠿⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀", false]],
  [["⠀⠀⢠⣾⡿⣁⣤⣶⣿⠿⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀", false]],
  [["⠀⣰⣿⣿⣿⠿⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀", false], ["⣾⣿⣿⣿⣿⣿⡇⠀", true]],
  [["⠘⠻⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀", false], ["⠈⠉⠉⠉⠉⠉⠁⠀", true]],
];

// White-on-transparent PNG (gray+alpha) of the mark, tinted at runtime for Kitty graphics.
export const LOGO_MARK_PNG_BASE64 =
  "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" +
  "YII=";
