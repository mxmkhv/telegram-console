import { memo, useContext, useEffect, useState } from "react";
import { useStdout } from "ink";
import { Box, Text, useSkin } from "./ui";
import { ColorModeContext } from "./ui/ColorModeContext";
import { LOGO_BRAILLE, LOGO_COLS, LOGO_MARK_PNG_BASE64, LOGO_ROWS } from "./logoAssets";
import {
  LOGO_IMAGE_ID,
  clearKittyImage,
  placeholderGridWindow,
  supportsKittyGraphics,
  tintAlphaMask,
  transmitAndPlace,
} from "../services/kittyImage.js";

export { LOGO_COLS, LOGO_ROWS };

const BRAND_BLUE = "#2AABEE";

// Holds the logo's footprint while the Kitty image is being prepared, so the
// layout doesn't shift when it appears. U+2800 (blank braille) rather than
// spaces: Ink trims whitespace-only rows.
const RESERVED_SPACE = Array.from({ length: LOGO_ROWS }, () => "⠀".repeat(LOGO_COLS)).join("\n");

/**
 * The project mark (logo.svg). Real pixels via the Kitty graphics protocol on
 * terminals that support it (Ghostty, Kitty, WezTerm, iTerm 3.6+), braille
 * everywhere else. Both are LOGO_COLS × LOGO_ROWS cells.
 */
export const Logo = memo(function Logo() {
  const { stdout } = useStdout();
  const grayscale = useContext(ColorModeContext);
  const skin = useSkin();
  const tint = skin.colorMap.cyan ?? BRAND_BLUE;
  const kittyCapable = !grayscale && supportsKittyGraphics(stdout);

  // The tint the terminal currently holds an image for; a skin switch makes it stale.
  const [transmittedTint, setTransmittedTint] = useState<string | null>(null);
  const [kittyFailed, setKittyFailed] = useState(false);

  useEffect(() => {
    if (!kittyCapable) return;
    let cancelled = false;
    let transmitted = false;
    tintAlphaMask(Buffer.from(LOGO_MARK_PNG_BASE64, "base64"), tint)
      .then((png) => {
        if (cancelled) return;
        stdout.write(transmitAndPlace(png, LOGO_COLS, LOGO_ROWS, LOGO_IMAGE_ID));
        transmitted = true;
        setTransmittedTint(tint);
      })
      // The braille rendition is a complete substitute, so fall back to it.
      .catch(() => {
        if (!cancelled) setKittyFailed(true);
      });
    return () => {
      cancelled = true;
      if (transmitted) stdout.write(clearKittyImage(LOGO_IMAGE_ID));
    };
  }, [kittyCapable, tint, stdout]);

  if (kittyCapable && !kittyFailed) {
    return (
      <Text>
        {transmittedTint === tint
          ? placeholderGridWindow(LOGO_COLS, LOGO_ROWS, 0, 0, LOGO_COLS, LOGO_ROWS, LOGO_IMAGE_ID)
          : RESERVED_SPACE}
      </Text>
    );
  }

  return (
    <Box flexDirection="column">
      {LOGO_BRAILLE.map((runs, row) => (
        <Text key={row}>
          {runs.map(([text, dim], i) => (
            <Text key={i} color="cyan" dimColor={dim}>
              {text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  );
});
