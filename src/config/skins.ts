import type { SkinName } from "../types";

export interface Skin {
  name: SkinName;
  label: string;
  // Remaps the app's semantic Ink color names (cyan = accent, blue = secondary)
  // to skin-specific colors. Empty map = no remapping (current look unchanged).
  // Hex only: the Kitty logo tints its image with the accent (tintAlphaMask).
  colorMap: Record<string, `#${string}`>;
  glyphs: {
    caret: string;
  };
  spacing: {
    // Vertical padding for self-contained modal-style panels (Settings, Logout,
    // Reaction picker). Not applied to the main chat layout, which has a fixed
    // terminal-height budget that extra rows would overflow.
    panelPaddingY: number;
  };
  // When true, the input box drops its border and the input row + ShortcutsBar
  // are separated from what's above by a thin rule instead, so the two read as
  // one merged control (Claude Code CLI's look) instead of a bordered box.
  inputRibbon: boolean;
  // When true, the main layout panels (header, chat list, message view, status
  // bar) drop their full box border in favor of a single thin rule between
  // adjacent panels, instead of framing each one individually.
  panelDividers: boolean;
}

// `satisfies` (rather than `: Record<SkinName, Skin>`) keeps the concrete
// "default" | "claudeCode" keys so lookups below stay Skin, not Skin | undefined,
// under this project's noUncheckedIndexedAccess setting.
export const SKINS = {
  default: {
    name: "default",
    label: "Default",
    colorMap: {},
    glyphs: { caret: "▸" },
    spacing: { panelPaddingY: 1 },
    inputRibbon: false,
    panelDividers: false,
  },
  claudeCode: {
    name: "claudeCode",
    label: "Claude Code",
    colorMap: {
      cyan: "#D97757",
      blue: "#B8A990",
    },
    glyphs: { caret: "❯" },
    spacing: { panelPaddingY: 2 },
    inputRibbon: true,
    panelDividers: true,
  },
} satisfies Record<SkinName, Skin>;

export const SKIN_NAMES: SkinName[] = ["default", "claudeCode"];

export function getSkin(name: SkinName): Skin {
  return SKINS[name] ?? SKINS.default;
}
