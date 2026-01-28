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

// Inline preview constraints
const MAX_PREVIEW_WIDTH = 25;
const MAX_PREVIEW_HEIGHT = 15;

export function calculatePreviewDimensions(imageWidth: number, imageHeight: number): { width: number; height: number } {
  const aspectRatio = imageWidth / imageHeight;

  // Try fitting by height first
  let width = Math.round(MAX_PREVIEW_HEIGHT * aspectRatio);
  let height = MAX_PREVIEW_HEIGHT;

  // If width exceeds max, fit by width instead
  if (width > MAX_PREVIEW_WIDTH) {
    width = MAX_PREVIEW_WIDTH;
    height = Math.round(MAX_PREVIEW_WIDTH / aspectRatio);
  }

  // Ensure minimum dimensions
  return {
    width: Math.max(5, Math.min(width, MAX_PREVIEW_WIDTH)),
    height: Math.max(3, Math.min(height, MAX_PREVIEW_HEIGHT)),
  };
}

// Strip ANSI escape codes to measure actual display width
function stripAnsi(str: string): string {
  // Match all ANSI escape sequences including OSC, CSI, etc.
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)/g, '');
}

export interface PreviewResult {
  image: string;
  width: number;
  height: number;
}

export async function renderInlinePreview(buffer: Buffer, width: number, height: number): Promise<PreviewResult> {
  const result = await renderWithAnsiBlocks(buffer, {
    width,
    height,
    preserveAspectRatio: true,
  });

  // Trim trailing newlines
  const image = result.replace(/\n+$/, '');

  // Measure actual dimensions
  const lines = image.split('\n');
  const actualHeight = lines.length;
  const actualWidth = Math.max(...lines.map(line => stripAnsi(line).length));

  return { image, width: actualWidth, height: actualHeight };
}

export async function renderPanelImage(
  buffer: Buffer,
  panelWidth: number,
  maxHeight?: number
): Promise<string> {
  // Account for border (2 chars) + paddingX (2 chars) = 4 chars overhead
  const contentWidth = panelWidth - 4;

  const result = await renderWithAnsiBlocks(buffer, {
    width: contentWidth,
    height: maxHeight,
    preserveAspectRatio: true,
  });

  // Trim trailing newlines to prevent extra spacing
  return result.replace(/\n+$/, '');
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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
    voice: '🎤',
  };

  const icon = media.isAnimated ? '🎭' : icons[media.type] ?? '📎';
  const size = media.fileSize ? formatBytes(media.fileSize) : '';
  const dims = media.width && media.height ? `${media.width}x${media.height}` : '';
  const emoji = media.emoji ? `: ${media.emoji}` : '';
  const duration = media.duration != null ? formatDuration(media.duration) : '';

  const parts = [size, dims, duration].filter(Boolean).join(', ');
  let label: string;
  if (media.type === 'sticker') {
    label = `${media.isAnimated ? 'Animated Sticker' : 'Sticker'}${emoji}`;
  } else if (media.type === 'voice') {
    label = 'Voice';
  } else {
    label = capitalize(media.type);
  }

  const result = `[${icon} ${label}${parts ? `: ${parts}` : ''}]`;
  metadataCache.set(messageId, result);
  return result;
}
