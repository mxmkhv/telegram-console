import { useContext, type ComponentProps } from "react";
import { Box as InkBox, Text as InkText } from "ink";
import { ColorModeContext } from "./ColorModeContext";
import { SkinContext } from "./SkinContext";
import { getSkin, type Skin } from "../../config/skins";

export { useSkin } from "./SkinContext";

type TextProps = ComponentProps<typeof InkText>;
type BoxProps = ComponentProps<typeof InkBox>;

// Map the app's named colors to ansi256 grayscale shades (232=black … 255=white),
// preserving a rough brightness hierarchy so the UI stays readable without color.
// Brighter shades go to the "important" cues (focus/active/unread), dimmer to the rest.
const GRAY_BY_NAME: Record<string, string> = {
  cyan: "ansi256(255)", // focus / active / unread — brightest
  cyanBright: "ansi256(255)",
  white: "ansi256(252)",
  whiteBright: "ansi256(255)",
  blue: "ansi256(252)", // your messages
  green: "ansi256(250)",
  greenBright: "ansi256(252)",
  yellow: "ansi256(250)",
  yellowBright: "ansi256(252)",
  magenta: "ansi256(248)",
  magentaBright: "ansi256(250)",
  red: "ansi256(248)",
  redBright: "ansi256(250)",
  gray: "ansi256(244)",
  grey: "ansi256(244)",
};

const DEFAULT_GRAY = "ansi256(250)";

/**
 * Maps an Ink color value to a grayscale ansi256 shade. `undefined`/non-string
 * values pass through unchanged (so unset colors stay the terminal default).
 * Pure and side-effect free for easy testing.
 */
export function toGray(color: TextProps["color"]): TextProps["color"] {
  if (typeof color !== "string") return color;
  return GRAY_BY_NAME[color] ?? DEFAULT_GRAY;
}

// Backgrounds only flash a message: one shade dark enough for light text on top
const GRAY_BACKGROUND = "ansi256(242)";

/**
 * Returns the Text props to forward to Ink. In grayscale mode `color` is mapped
 * to a gray shade and any `backgroundColor` becomes one mid gray; all formatting
 * props (inverse, bold, dimColor, …) are preserved.
 */
export function grayscaleTextProps(props: TextProps, grayscale: boolean): TextProps {
  if (!grayscale) return props;
  const { backgroundColor, ...rest } = props;
  return { ...rest, color: toGray(props.color), ...(backgroundColor ? { backgroundColor: GRAY_BACKGROUND } : null) };
}

/**
 * Returns the Box props to forward to Ink. In grayscale mode `borderColor` is
 * mapped to a gray shade; all other props are preserved.
 */
export function grayscaleBoxProps(props: BoxProps, grayscale: boolean): BoxProps {
  if (!grayscale) return props;
  return { ...props, borderColor: toGray(props.borderColor) };
}

/**
 * Remaps a color through the active skin's colorMap (e.g. cyan -> the skin's
 * accent color). Passes through unchanged for the default skin or unmapped
 * colors, so most components never need to know a skin is active.
 */
function applySkinColor(color: TextProps["color"], skin: Skin): TextProps["color"] {
  if (typeof color !== "string") return color;
  return skin.colorMap[color] ?? color;
}

export function skinTextProps(props: TextProps, skin: Skin): TextProps {
  if (Object.keys(skin.colorMap).length === 0) return props;
  return {
    ...props,
    color: applySkinColor(props.color, skin),
    backgroundColor: applySkinColor(props.backgroundColor, skin),
  };
}

export function skinBoxProps(props: BoxProps, skin: Skin): BoxProps {
  if (Object.keys(skin.colorMap).length === 0) return props;
  return { ...props, borderColor: applySkinColor(props.borderColor, skin) };
}

export function Text(props: TextProps) {
  const grayscale = useContext(ColorModeContext);
  const skin = getSkin(useContext(SkinContext));
  // noColor always wins: grayscale is computed from the original semantic
  // color name, independent of which skin is active.
  if (grayscale) return <InkText {...grayscaleTextProps(props, true)} />;
  return <InkText {...skinTextProps(props, skin)} />;
}

export function Box(props: BoxProps) {
  const grayscale = useContext(ColorModeContext);
  const skin = getSkin(useContext(SkinContext));
  if (grayscale) return <InkBox {...grayscaleBoxProps(props, true)} />;
  return <InkBox {...skinBoxProps(props, skin)} />;
}
