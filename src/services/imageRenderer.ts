import terminalImage from 'terminal-image';
import type { MediaAttachment } from '../types/index.js';
import { describeMedia } from '../utils/media.js';

/**
 * Wrapper that forces ANSI half-block rendering instead of native inline-image
 * protocols (iTerm2, Kitty/Ghostty, Sixel). Those protocols write escape codes
 * directly to stdout and return an empty string, which Ink's frame renderer then
 * clobbers — leaving the media panel blank. `preferNativeRender: false` makes
 * terminal-image skip all protocol detection and emit ANSI blocks, the only mode
 * that composes with Ink's <Text>.
 */
async function renderWithAnsiBlocks(
  buffer: Buffer,
  options: { width?: number | string; height?: number | string; preserveAspectRatio?: boolean }
): Promise<string> {
  return terminalImage.buffer(buffer, { ...options, preferNativeRender: false });
}

export async function renderPanelImage(
  buffer: Buffer,
  panelWidth: number,
  maxHeight?: number,
  zoom = 1
): Promise<string> {
  // Account for border (2 chars) + paddingX (2 chars) = 4 chars overhead.
  // Magnify by `zoom` — the caller slices a viewport-sized window out of the
  // oversized render (see sliceAnsiViewport) so zoom > 1 can be panned.
  const contentWidth = Math.round((panelWidth - 4) * zoom);
  const height = maxHeight != null ? Math.round(maxHeight * zoom) : undefined;

  const result = await renderWithAnsiBlocks(buffer, {
    width: contentWidth,
    height,
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
  } else if (bytes < 1024 * 1024 * 1024) {
    result = `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  } else {
    result = `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }

  formatBytesCache.set(bytes, result);
  return result;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Keyed by the attachment: message ids repeat across chats
const metadataCache = new WeakMap<MediaAttachment, string>();

const MEDIA_ICONS: Record<MediaAttachment['type'], string> = {
  photo: '📷',
  sticker: '😀',
  gif: '🎬',
  video: '🎥',
  videoNote: '🎥',
  voice: '🎤',
  audio: '🎵',
  document: '📄',
  poll: '📊',
  location: '📍',
  contact: '👤',
  other: '📎',
};

export function formatMediaMetadata(media: MediaAttachment): string {
  const cached = metadataCache.get(media);
  if (cached) return cached;

  // Dice and the like carry their own emoji
  const icon = media.isAnimated ? '🎭' : media.type === 'other' && media.emoji ? '' : MEDIA_ICONS[media.type];
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
    label = describeMedia(media);
  }

  const result = `[${[icon, label].filter(Boolean).join(' ')}${parts ? `: ${parts}` : ''}]`;
  metadataCache.set(media, result);
  return result;
}
