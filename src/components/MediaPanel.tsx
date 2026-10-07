import React, { useState, useEffect, useMemo } from 'react';
import { useInput } from 'ink';
import { Box, Text } from './ui';
import type { Message } from '../types/index.js';
import { getMediaBuffer } from '../services/mediaCache.js';
import { renderPanelImage, formatMediaMetadata } from '../services/imageRenderer.js';
import { measureAnsiImage, sliceAnsiViewport } from '../services/ansiViewport.js';
import { supportsKittyGraphics, buildKittyImage, placeholderGridWindow, clearKittyImage } from '../services/kittyImage.js';

// Panel chrome: border(2) + header(1) + marginBottom(1) + marginTop(1) + metadata(1) + hint(1) = 7 rows
// Plus 1 for bottom border inner = 8 total non-image rows
const PANEL_CHROME_ROWS = 8;
const MIN_IMAGE_HEIGHT = 4;

// Space cycles through these magnification levels, wrapping 3 → 1 (fit).
const ZOOM_LEVELS = [1, 1.5, 2, 2.5, 3] as const;
const PAN_STEP = 2;
const ZOOMABLE_TYPES = new Set(['photo', 'sticker', 'gif', 'video', 'videoNote', 'document']);

// The image is rendered once per zoom change; panning windows over this data.
type RenderData =
  | { kind: 'kitty'; placementCols: number; placementRows: number; viewCols: number; viewRows: number }
  | { kind: 'ansi'; image: string; cols: number; rows: number; viewCols: number; viewRows: number };

// Placement/viewport dims for the current render, in [placement, view] pairs per axis.
function renderDims(r: RenderData): { pw: number; vw: number; ph: number; vh: number } {
  return r.kind === 'kitty'
    ? { pw: r.placementCols, vw: r.viewCols, ph: r.placementRows, vh: r.viewRows }
    : { pw: r.cols, vw: r.viewCols, ph: r.rows, vh: r.viewRows };
}

function clampPan(value: number, placement: number, view: number): number {
  return Math.max(0, Math.min(value, placement - view));
}

interface Props {
  message: Message;
  panelWidth: number;
  panelHeight: number;
  downloadMedia: (message: Message) => Promise<Buffer | undefined>;
  onClose: () => void;
  isFocused?: boolean;
}

export function MediaPanel({ message, panelWidth, panelHeight, downloadMedia, onClose, isFocused = true }: Props) {
  const messageId = message.id;
  const media = message.media!;
  const isZoomable = ZOOMABLE_TYPES.has(media.type);

  const imageMaxHeight = Math.max(MIN_IMAGE_HEIGHT, panelHeight - PANEL_CHROME_ROWS);

  const [zoomIndex, setZoomIndex] = useState(0);
  const zoom = ZOOM_LEVELS[zoomIndex]!;

  // Viewport offset in cells. Recentered when the render (re)builds; panned by arrows.
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const [render, setRender] = useState<RenderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useInput((input, key) => {
    if (key.return || key.escape) {
      onClose();
      return;
    }
    if (input === ' ' && isZoomable) {
      setZoomIndex((i) => (i + 1) % ZOOM_LEVELS.length);
      return;
    }
    if (!render) return;
    const { pw, vw, ph, vh } = renderDims(render);
    if (key.leftArrow) setPanX((x) => clampPan(x - PAN_STEP, pw, vw));
    else if (key.rightArrow) setPanX((x) => clampPan(x + PAN_STEP, pw, vw));
    else if (key.upArrow) setPanY((y) => clampPan(y - PAN_STEP, ph, vh));
    else if (key.downArrow) setPanY((y) => clampPan(y + PAN_STEP, ph, vh));
  }, { isActive: isFocused });

  // Heavy work (download + transmit/render) runs per zoom change, not per pan.
  useEffect(() => {
    let cancelled = false;
    let transmittedKitty = false;

    (async () => {
      try {
        const buffer = await getMediaBuffer(messageId, () => downloadMedia(message));
        if (cancelled || !buffer) {
          if (!cancelled && !buffer) {
            setError('Failed to download');
            setLoading(false);
          }
          return;
        }

        // Crisp path: Kitty graphics via Unicode placeholders (Ghostty, iTerm 3.6+).
        // The image is transmitted once at the zoomed placement size; only a
        // viewport-sized window of placeholder cells is drawn, so pan just shifts
        // which window we render — no re-transmit.
        if (supportsKittyGraphics()) {
          const contentWidth = panelWidth - 4; // border(2) + paddingX(2)
          const k = await buildKittyImage(buffer, contentWidth, imageMaxHeight, zoom);
          if (cancelled) return;
          process.stdout.write(k.control);
          transmittedKitty = true;
          setRender({ kind: 'kitty', placementCols: k.placementCols, placementRows: k.placementRows, viewCols: k.viewCols, viewRows: k.viewRows });
          setPanX(Math.max(0, Math.round((k.placementCols - k.viewCols) / 2)));
          setPanY(Math.max(0, Math.round((k.placementRows - k.viewRows) / 2)));
          setLoading(false);
          return;
        }

        // Fallback: ANSI half-blocks rendered at the zoomed size, sliced to a
        // viewport window (see sliceAnsiViewport) so it can be panned too.
        const img = await renderPanelImage(buffer, panelWidth, imageMaxHeight, zoom);
        if (cancelled) return;
        const { cols, rows } = measureAnsiImage(img);
        const viewCols = Math.max(1, Math.round(cols / zoom));
        const viewRows = Math.max(1, Math.round(rows / zoom));
        setRender({ kind: 'ansi', image: img, cols, rows, viewCols, viewRows });
        setPanX(Math.max(0, Math.round((cols - viewCols) / 2)));
        setPanY(Math.max(0, Math.round((rows - viewRows) / 2)));
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (transmittedKitty) process.stdout.write(clearKittyImage());
    };
  }, [messageId, message, downloadMedia, panelWidth, imageMaxHeight, zoom]);

  // Cheap: window the already-rendered image at the current pan offset.
  const display = useMemo(() => {
    if (!render) return null;
    if (render.kind === 'kitty') {
      return placeholderGridWindow(render.placementCols, render.placementRows, panX, panY, render.viewCols, render.viewRows);
    }
    if (zoom === 1) return render.image;
    return sliceAnsiViewport(render.image, panX, panY, render.viewCols, render.viewRows);
  }, [render, panX, panY, zoom]);

  const metadata = formatMediaMetadata(media);

  const focusColor = isFocused ? 'cyan' : 'blue';

  const zoomHint = isZoomable
    ? `Space zoom (${zoom.toFixed(1)}×)${zoom > 1 ? ' · arrows pan' : ''} · `
    : '';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={focusColor}
      width={panelWidth}
      height={panelHeight}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color={focusColor}>Media</Text>
      </Box>

      <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
        {loading && <Text dimColor>Loading...</Text>}
        {error && <Text color="red">⚠ {error}</Text>}
        {display && <Text>{display}</Text>}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text dimColor>{metadata}</Text>
        <Text dimColor>{zoomHint}Enter/Esc to close</Text>
      </Box>
    </Box>
  );
}
