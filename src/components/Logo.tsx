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

const LOGO_PLACEHOLDERS = placeholderGridWindow(LOGO_COLS, LOGO_ROWS, 0, 0, LOGO_COLS, LOGO_ROWS, LOGO_IMAGE_ID);

/**
 * The project mark (logo.svg). Real pixels via the Kitty graphics protocol when
 * the terminal is detected as capable (see supportsKittyGraphics), braille
 * everywhere else and in grayscale mode. Both are LOGO_COLS × LOGO_ROWS cells.
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
      // Only a bug can land here (skin tints are typed hex, the PNG is embedded),
      // and the braille rendition is a complete substitute, so fall back to it.
      .catch(() => {
        if (!cancelled) setKittyFailed(true);
      });
    return () => {
      cancelled = true;
      if (transmitted) {
        stdout.write(clearKittyImage(LOGO_IMAGE_ID));
        setTransmittedTint(null);
      }
    };
  }, [kittyCapable, tint, stdout]);

  if (kittyCapable && !kittyFailed) {
    if (transmittedTint !== tint) return <Box width={LOGO_COLS} height={LOGO_ROWS} />;
    return <Text>{LOGO_PLACEHOLDERS}</Text>;
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
