# Media Display Feature Design

## Overview

Add image, sticker, and GIF display support to the TUI Telegram client with progressive disclosure UX: placeholder → inline preview → full side panel view.

## Decisions

| Decision | Choice |
|----------|--------|
| Media types | Photos, stickers (static rendered, animated metadata), GIFs |
| Rendering engine | `terminal-image` (ANSI blocks), configurable later |
| Display levels | Placeholder → inline preview (selected) → side panel (Enter) |
| Panel layout | Right side, ~40% width, split view |
| Caching | In-memory LRU cache (50 items), no disk cache |
| Sticker handling | Static WebP rendered, animated/video show metadata |
| GIF handling | Static thumbnail normally, animate in panel (stretch) |
| Panel controls | Focus panel on open, Enter/Escape to close |
| Metadata format | Type + size + dimensions `[📷 Photo: 1.2MB, 1920x1080]` |

## Data Model

### New Types (`src/types/index.ts`)

```typescript
type MediaType = 'photo' | 'sticker' | 'gif' | 'video' | 'document';

interface MediaAttachment {
  type: MediaType;
  fileSize?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  emoji?: string;           // for stickers
  isAnimated?: boolean;     // TGS/video stickers
  fileName?: string;
  _message: Api.Message;    // GramJS reference for download
}

interface Message {
  id: number;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  isOutgoing: boolean;
  media?: MediaAttachment;  // NEW
}
```

### State Extensions (`src/state/reducer.ts`)

```typescript
interface AppState {
  // ... existing fields
  mediaPanel: {
    isOpen: boolean;
    messageId: number | null;
    loading: boolean;
    imageData: string | null;  // ANSI string from terminal-image
    error: string | null;
  };
  // Inline preview state per message (keyed by messageId)
  inlinePreviews: Map<number, {
    loading: boolean;
    imageData: string | null;
    error: string | null;
  }>;
}
```

### New Actions

```typescript
type Action =
  | { type: 'OPEN_MEDIA_PANEL'; payload: { messageId: number } }
  | { type: 'CLOSE_MEDIA_PANEL' }
  | { type: 'SET_MEDIA_LOADING'; payload: boolean }
  | { type: 'SET_MEDIA_DATA'; payload: string }
  | { type: 'SET_MEDIA_ERROR'; payload: string }
  // Inline preview actions
  | { type: 'SET_INLINE_PREVIEW_LOADING'; payload: { messageId: number } }
  | { type: 'SET_INLINE_PREVIEW_DATA'; payload: { messageId: number; imageData: string } }
  | { type: 'SET_INLINE_PREVIEW_ERROR'; payload: { messageId: number; error: string } }
```

## GramJS Media Extraction

### Extract Media from Messages (`src/services/telegram.ts`)

```typescript
import { Api } from "telegram";

function extractMedia(msg: Api.Message): MediaAttachment | undefined {
  const { media } = msg;
  if (!media) return undefined;

  // Photo
  if (media.className === 'MessageMediaPhoto' && media.photo) {
    const photo = media.photo as Api.Photo;
    const largest = photo.sizes?.slice(-1)[0] as any;
    return {
      type: 'photo',
      fileSize: largest?.size,
      width: largest?.w,
      height: largest?.h,
      mimeType: 'image/jpeg',
      _message: msg,
    };
  }

  // Document (stickers, GIFs, files)
  if (media.className === 'MessageMediaDocument' && media.document) {
    const doc = media.document as Api.Document;
    const attrs = doc.attributes || [];

    // Check for sticker
    const stickerAttr = attrs.find(a => a.className === 'DocumentAttributeSticker');
    if (stickerAttr) {
      const isAnimated = doc.mimeType === 'application/x-tgsticker'
                      || doc.mimeType === 'video/webm';
      return {
        type: 'sticker',
        fileSize: Number(doc.size),
        emoji: (stickerAttr as any).alt,
        isAnimated,
        mimeType: doc.mimeType,
        _message: msg,
      };
    }

    // Check for GIF/animation
    const isAnimated = attrs.some(a => a.className === 'DocumentAttributeAnimated');
    if (isAnimated || doc.mimeType === 'video/mp4') {
      const videoAttr = attrs.find(a => a.className === 'DocumentAttributeVideo') as any;
      return {
        type: 'gif',
        fileSize: Number(doc.size),
        width: videoAttr?.w,
        height: videoAttr?.h,
        mimeType: doc.mimeType,
        _message: msg,
      };
    }
  }

  return undefined;
}
```

### Download Method

```typescript
async downloadMedia(message: Message): Promise<Buffer | undefined> {
  if (!message.media?._message) return undefined;
  const buffer = await client.downloadMedia(message.media._message, {});
  return buffer as Buffer;
}
```

## In-Memory Media Cache (`src/services/mediaCache.ts`)

**Why**: Prevents re-downloading media when navigating back to previously viewed messages or reopening the panel. Uses LRU eviction to bound memory usage.

```typescript
import { LRUCache } from 'lru-cache';

interface CachedMedia {
  buffer: Buffer;
  inlinePreview: string | null;  // Rendered ANSI for inline
  panelImage: string | null;     // Rendered ANSI for panel (size-specific)
}

// Module-level cache - persists across renders
const mediaCache = new LRUCache<number, CachedMedia>({
  max: 50,  // Max 50 media items in memory
  // Evict based on buffer size (rough estimate)
  maxSize: 100 * 1024 * 1024, // 100MB max
  sizeCalculation: (value) => value.buffer.length,
});

// Track in-flight requests to prevent duplicate downloads
const pendingDownloads = new Map<number, Promise<Buffer | undefined>>();

export async function getMediaBuffer(
  messageId: number,
  downloadFn: () => Promise<Buffer | undefined>
): Promise<Buffer | undefined> {
  // Check cache first
  const cached = mediaCache.get(messageId);
  if (cached) return cached.buffer;

  // Check if download already in progress (deduplication)
  const pending = pendingDownloads.get(messageId);
  if (pending) return pending;

  // Start new download
  const downloadPromise = downloadFn();
  pendingDownloads.set(messageId, downloadPromise);

  try {
    const buffer = await downloadPromise;
    if (buffer) {
      mediaCache.set(messageId, {
        buffer,
        inlinePreview: null,
        panelImage: null,
      });
    }
    return buffer;
  } finally {
    pendingDownloads.delete(messageId);
  }
}

export function getCachedInlinePreview(messageId: number): string | null {
  return mediaCache.get(messageId)?.inlinePreview ?? null;
}

export function setCachedInlinePreview(messageId: number, preview: string): void {
  const cached = mediaCache.get(messageId);
  if (cached) {
    cached.inlinePreview = preview;
  }
}

export function getCachedPanelImage(messageId: number): string | null {
  return mediaCache.get(messageId)?.panelImage ?? null;
}

export function setCachedPanelImage(messageId: number, image: string): void {
  const cached = mediaCache.get(messageId);
  if (cached) {
    cached.panelImage = image;
  }
}

export function clearCache(): void {
  mediaCache.clear();
  pendingDownloads.clear();
}
```

**Key optimizations**:
1. **LRU eviction** - Automatically removes least-recently-used items when cache is full
2. **Request deduplication** - `pendingDownloads` Map prevents duplicate concurrent downloads
3. **Rendered image caching** - Stores both buffer and rendered ANSI strings to avoid re-rendering

## Component Architecture

### File Structure

```
src/components/
├── MessageView.tsx      (modified - add inline previews)
├── MediaPlaceholder.tsx (NEW - renders [📷 Photo: 1.2MB])
├── MediaPreview.tsx     (NEW - small inline preview when selected)
├── MediaPanel.tsx       (NEW - full side panel view)
└── App.tsx              (modified - add panel to layout)
```

### Layout

```tsx
// Normal layout:
<Box flexDirection="row">
  <ChatList width={35} />
  <MessageView flexGrow={1} />
</Box>

// With media panel open:
<Box flexDirection="row">
  <ChatList width={35} />
  <MessageView flexGrow={1} />
  {state.mediaPanel.isOpen && (
    <MediaPanel width="40%" />
  )}
</Box>
```

### Focus Flow

```
Normal:     chatList ←→ messages ←→ input
                          ↓ (Enter on media message)
Panel open: chatList     messages     input
                              ↓
                         mediaPanel (focused)
                              ↓ (Enter/Escape)
                         closes → back to messages
```

## Display States

### Message with Media (Unselected)

```
[10:30] John: Check this out!
[📷 Photo: 1.2MB, 1920x1080]
```

### Message with Media (Selected)

```
[10:30] John: Check this out!
[📷 Photo: 1.2MB, 1920x1080]
┌────────────────────┐
│ ▄▄▀▀▄▄  ▄▄▀▀▄▄    │
│ ██████  ████▀▀    │
│ ▀▀▄▄▀▀  ▀▀▄▄██    │
└────────────────────┘
```

### Media Panel States

```
┌─ Media ─────────────────────┐
│                             │
│      Loading...             │  ← loading state
│                             │
└─────────────────────────────┘

┌─ Media ─────────────────────┐
│                             │
│  ▄▄▀▀▄▄▄▄▀▀▄▄  ▄▄▀▀▄▄      │
│  ████████████  ████▀▀      │  ← loaded image
│  ██▀▀████▀▀██  ▀▀▄▄██      │
│  ▀▀▄▄▀▀▀▀▄▄▀▀  ████▀▀      │
│                             │
│  Photo • 1.2MB • 1920x1080  │  ← metadata footer
└─ Enter/Esc to close ────────┘

┌─ Media ─────────────────────┐
│                             │
│  ⚠ Failed to load image    │  ← error state
│                             │
└─────────────────────────────┘
```

### Metadata Placeholders

```
[📷 Photo: 1.2MB, 1920x1080]
[🎬 GIF: 3.4MB, 320x240]
[😀 Sticker: wave]
[🎭 Animated Sticker: party]
```

## Image Rendering Utilities

### New Service (`src/services/imageRenderer.ts`)

```typescript
import terminalImage from 'terminal-image';

interface RenderOptions {
  width?: number | string;
  height?: number | string;
  preserveAspectRatio?: boolean;
}

export async function renderImageBuffer(
  buffer: Buffer,
  options: RenderOptions = {}
): Promise<string> {
  return terminalImage.buffer(buffer, {
    width: options.width ?? '90%',
    height: options.height,
    preserveAspectRatio: options.preserveAspectRatio ?? true,
  });
}

export async function renderInlinePreview(buffer: Buffer): Promise<string> {
  return terminalImage.buffer(buffer, {
    height: 5,
    preserveAspectRatio: true,
  });
}

export async function renderPanelImage(
  buffer: Buffer,
  panelWidth: number
): Promise<string> {
  return terminalImage.buffer(buffer, {
    width: Math.floor(panelWidth * 0.9),
    preserveAspectRatio: true,
  });
}

// GIF support (stretch goal)
export function renderGif(
  buffer: Buffer,
  panelWidth: number,
  onFrame: (frame: string) => void
): () => void {
  const stopFn = terminalImage.gifBuffer(buffer, {
    width: Math.floor(panelWidth * 0.9),
    renderFrame: onFrame,
  });
  return stopFn;
}
```

### Metadata Formatter (with Memoization)

```typescript
// Cache for formatBytes - avoids repeated string operations
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

// Cache for metadata strings - keyed by messageId for stability
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
```

**Why memoize**: These pure functions are called during render for every media message. Caching prevents repeated string concatenation and number formatting.

## MessageView Line Calculation

```typescript
function getMessageLineCount(msg: Message, isSelected: boolean): number {
  let lines = msg.text ? msg.text.split("\n").length : 0;

  if (msg.media) {
    lines += 1; // placeholder line

    if (isSelected && !msg.media.isAnimated) {
      lines += 6; // inline preview height
    }
  }

  return Math.max(lines, 1);
}
```

## Action Flows

### Inline Preview Flow (on message selection)

```
User navigates to a media message (j/k keys)
         ↓
MessageView re-renders with new selectedIndex
         ↓
MediaPreview component for selected message renders
         ↓
useEffect checks cache: getCachedInlinePreview(messageId)
         ↓ cache hit
Render cached ANSI string immediately (no loading state)
         ↓ cache miss
dispatch({ type: 'SET_INLINE_PREVIEW_LOADING', payload: { messageId } })
         ↓
getMediaBuffer(messageId, () => telegram.downloadMedia(message))
         ↓ (deduplicates concurrent requests automatically)
renderInlinePreview(buffer)
         ↓
setCachedInlinePreview(messageId, ansiString)
dispatch({ type: 'SET_INLINE_PREVIEW_DATA', payload: { messageId, imageData } })
```

**Key**: Cache check happens synchronously before any async work. This prevents flicker when navigating back to previously viewed messages.

### Panel Open Flow (Enter key)

```
User presses Enter on selected media message
         ↓
MessageView checks: does selected message have media?
         ↓ yes
dispatch({ type: 'OPEN_MEDIA_PANEL', payload: { messageId } })
         ↓
Focus moves to mediaPanel
         ↓
useEffect checks cache: getCachedPanelImage(messageId)
         ↓ cache hit
dispatch({ type: 'SET_MEDIA_DATA', payload: cachedImage })
(no loading state shown)
         ↓ cache miss
dispatch({ type: 'SET_MEDIA_LOADING', payload: true })
         ↓
getMediaBuffer(messageId, () => telegram.downloadMedia(message))
         ↓ (uses cached buffer if available from inline preview)
renderPanelImage(buffer, panelWidth)
         ↓
setCachedPanelImage(messageId, ansiString)
dispatch({ type: 'SET_MEDIA_DATA', payload: ansiString })
         ↓
MediaPanel renders the image
```

**Key**: If user viewed inline preview first, buffer is already cached. Only re-rendering at panel size is needed.

## Implementation Plan

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/MediaPlaceholder.tsx` | Inline metadata display |
| `src/components/MediaPreview.tsx` | Small inline preview when selected (memoized) |
| `src/components/MediaPanel.tsx` | Full side panel view |
| `src/services/imageRenderer.ts` | terminal-image wrapper utilities |
| `src/services/mediaCache.ts` | LRU cache for buffers and rendered images |

### Files to Modify

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `MediaAttachment` type, extend `Message` |
| `src/services/telegram.ts` | Add `extractMedia()`, `downloadMedia()` |
| `src/state/reducer.ts` | Add `mediaPanel` state, new actions |
| `src/components/MessageView.tsx` | Integrate placeholders, previews, line counting |
| `src/components/App.tsx` | Add MediaPanel to layout, handle focus |

### New Dependencies

```json
{
  "terminal-image": "^3.0.0",
  "lru-cache": "^10.0.0"
}
```

**Note on `terminal-image`**: Import the specific functions needed rather than the default export to minimize bundle impact:
```typescript
// Preferred: direct function import
import { buffer as renderBuffer, gifBuffer } from 'terminal-image';

// Avoid: barrel import pulls in all exports
import terminalImage from 'terminal-image';
```

### Implementation Order

1. Types and data model
2. GramJS media extraction
3. **Media cache service** (before components to enable caching from start)
4. Image renderer utilities
5. MediaPlaceholder component (memoized)
6. State management updates (including inline preview state)
7. **MediaPreview component** (with cache integration)
8. MessageView integration
9. MediaPanel component (with cache integration)
10. App layout changes
11. GIF animation (stretch goal)

## Performance Considerations

### Re-render Optimization

**MediaPlaceholder**: Should be memoized with `React.memo()` since it receives static media metadata:
```tsx
const MediaPlaceholder = memo(function MediaPlaceholder({
  media,
  messageId
}: Props) {
  const metadata = formatMediaMetadata(media, messageId);
  return <Text>{metadata}</Text>;
});
```

**MediaPreview**: Must be memoized to prevent re-rendering when other messages change:
```tsx
const MediaPreview = memo(function MediaPreview({
  messageId,
  media
}: Props) {
  // Cache check is synchronous - no loading flicker on cache hit
  const cachedPreview = getCachedInlinePreview(messageId);
  const [preview, setPreview] = useState(cachedPreview);
  const [loading, setLoading] = useState(!cachedPreview);

  useEffect(() => {
    if (cachedPreview) return; // Already have it

    let cancelled = false;

    (async () => {
      const buffer = await getMediaBuffer(messageId, () =>
        telegramService.downloadMedia(message)
      );
      if (cancelled || !buffer) return;

      const rendered = await renderInlinePreview(buffer);
      if (cancelled) return;

      setCachedInlinePreview(messageId, rendered);
      setPreview(rendered);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [messageId]);

  if (loading) return <Text dimColor>Loading preview...</Text>;
  if (!preview) return null;
  return <Text>{preview}</Text>;
});
```

### Avoiding Waterfalls

1. **Don't await in render path**: Cache checks are synchronous. Async downloads happen in useEffect.
2. **Request deduplication**: `pendingDownloads` Map prevents duplicate concurrent downloads when rapidly navigating messages.
3. **Buffer reuse**: Panel view reuses buffer from inline preview - only re-renders at different size.

## Implementation Clarifications (from interview)

| Question | Decision |
|----------|----------|
| Service structure | Factory function `createTelegramService` returns object with methods. Add `downloadMedia` to returned object. |
| Service access | Currently in state. Create `TelegramContext` for cleaner access in components. |
| Keyboard handling | `useInput` per component. MediaPanel uses own useInput for Enter/Escape. |
| Rapid navigation | **Debounce 200ms** before starting download, cancel pending on selection change. |
| Inline preview scope | **All non-animated**: photos, static stickers, GIF thumbnails. |
| Panel pattern | MediaPanel is first side panel - establishes the pattern. |

### Debounce Implementation for MediaPreview

```typescript
useEffect(() => {
  if (cachedPreview) return;

  let cancelled = false;
  const timeoutId = setTimeout(async () => {
    if (cancelled) return;
    // ... download logic
  }, 200); // 200ms debounce

  return () => {
    cancelled = true;
    clearTimeout(timeoutId); // Cancel pending debounced download
  };
}, [messageId]);
```

## Out of Scope

- Disk caching
- User configuration for rendering mode
- Sending media
- Video playback
- Voice messages
