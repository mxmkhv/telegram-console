import terminalImage from 'terminal-image';
import type { MediaAttachment } from '../types/index.js';

/**
 * Wrapper that forces ANSI block rendering instead of iTerm2/Kitty inline images.
 * The iTerm2 protocol uses OSC escape sequences that don't render through Ink's <Text>.
 * We temporarily unset TERM_PROGRAM during render to trigger the fallback.
 */
async function renderWithAnsiBlocks(
  buffer: Buffer,
  options: { width?: number | string; height?: number | string; preserveAspectRatio?: boolean }
): Promise<string> {
  const originalTermProgram = process.env.TERM_PROGRAM;
  const originalLcTerminal = process.env.LC_TERMINAL;
  const originalKonsole = process.env.KONSOLE_VERSION;

  // Temporarily disable terminal graphics detection
  delete process.env.TERM_PROGRAM;
  delete process.env.LC_TERMINAL;
  delete process.env.KONSOLE_VERSION;

  try {
    return await terminalImage.buffer(buffer, options);
  } finally {
    // Restore environment
    if (originalTermProgram) process.env.TERM_PROGRAM = originalTermProgram;
    if (originalLcTerminal) process.env.LC_TERMINAL = originalLcTerminal;
    if (originalKonsole) process.env.KONSOLE_VERSION = originalKonsole;
  }
}

interface RenderOptions {
  width?: number | string;
  height?: number | string;
  preserveAspectRatio?: boolean;
}

export async function renderImageBuffer(
  buffer: Buffer,
  options: RenderOptions = {}
): Promise<string> {
  return renderWithAnsiBlocks(buffer, {
    width: options.width ?? '90%',
    height: options.height,
    preserveAspectRatio: options.preserveAspectRatio ?? true,
  });
}

export async function renderInlinePreview(buffer: Buffer): Promise<string> {
  return renderWithAnsiBlocks(buffer, {
    height: 5,
    preserveAspectRatio: true,
  });
}

export async function renderPanelImage(
  buffer: Buffer,
  panelWidth: number
): Promise<string> {
  return renderWithAnsiBlocks(buffer, {
    width: Math.floor(panelWidth * 0.9),
    preserveAspectRatio: true,
  });
}

// Memoization caches
const formatBytesCache = new Map<number, string>();

function formatBytes(bytes: number): string {
  const cached = formatBytesCache.get(bytes);
  if (cached) return cached;

  let result: string;
  if (bytes < 1024) {
    result = `${bytes}B`;
  } else if (bytes < 1024 * 1024) {
    result = `${(bytes / 1024).toFixed(1)}KB`;
  } else {
    result = `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  formatBytesCache.set(bytes, result);
  return result;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const metadataCache = new Map<number, string>();

export function formatMediaMetadata(media: MediaAttachment, messageId: number): string {
  const cached = metadataCache.get(messageId);
  if (cached) return cached;

  const icons: Record<string, string> = {
    photo: '📷',
    sticker: '😀',
    gif: '🎬',
    video: '🎥',
    document: '📄',
  };

  const icon = media.isAnimated ? '🎭' : icons[media.type] ?? '📎';
  const size = media.fileSize ? formatBytes(media.fileSize) : '';
  const dims = media.width && media.height ? `${media.width}x${media.height}` : '';
  const emoji = media.emoji ? `: ${media.emoji}` : '';

  const parts = [size, dims].filter(Boolean).join(', ');
  const label = media.type === 'sticker'
    ? `${media.isAnimated ? 'Animated Sticker' : 'Sticker'}${emoji}`
    : capitalize(media.type);

  const result = `[${icon} ${label}${parts ? `: ${parts}` : ''}]`;
  metadataCache.set(messageId, result);
  return result;
}
