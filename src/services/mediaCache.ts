import { LRUCache } from 'lru-cache';
import type { MediaAttachment } from '../types/index.js';

interface CachedMedia {
  buffer: Buffer;
}

// By Telegram's file id: message ids repeat across chats, and an edit can swap
// the file. Without one (mock media), by the attachment itself.
type MediaKey = string | MediaAttachment;

const mediaCache = new LRUCache<MediaKey, CachedMedia>({
  max: 50,
  maxSize: 100 * 1024 * 1024, // 100MB
  sizeCalculation: (value) => value.buffer.length,
});

const pendingDownloads = new Map<MediaKey, Promise<Buffer | undefined>>();

export async function getMediaBuffer(
  media: MediaAttachment,
  downloadFn: () => Promise<Buffer | undefined>
): Promise<Buffer | undefined> {
  const key: MediaKey = media.fileId ?? media;
  const cached = mediaCache.get(key);
  if (cached) return cached.buffer;

  const pending = pendingDownloads.get(key);
  if (pending) return pending;

  const downloadPromise = downloadFn();
  pendingDownloads.set(key, downloadPromise);

  try {
    const buffer = await downloadPromise;
    if (buffer) {
      mediaCache.set(key, { buffer });
    }
    return buffer;
  } finally {
    pendingDownloads.delete(key);
  }
}
