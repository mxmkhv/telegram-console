import type { MediaAttachment } from "../types";

// The media panel draws images. Video and animated stickers show a still frame.
const PREVIEW_FRAME_TYPES = new Set<MediaAttachment["type"]>(["gif", "video", "videoNote"]);
const IMAGE_TYPES = new Set<MediaAttachment["type"]>(["photo", "sticker"]);

/** Shown as its preview frame rather than downloaded whole */
export function needsPreviewFrame(media: MediaAttachment): boolean {
  return PREVIEW_FRAME_TYPES.has(media.type) || (media.type === "sticker" && !!media.isAnimated);
}

/** Whether Enter opens it in the media panel */
export function canViewMedia(media: MediaAttachment): boolean {
  if (IMAGE_TYPES.has(media.type) || PREVIEW_FRAME_TYPES.has(media.type)) return true;
  // Images sent as files; SVG isn't something the renderer draws
  return media.type === "document" && !!media.mimeType?.startsWith("image/") && media.mimeType !== "image/svg+xml";
}

const MEDIA_NAMES: Record<MediaAttachment["type"], string> = {
  photo: "Photo",
  sticker: "Sticker",
  gif: "GIF",
  video: "Video",
  videoNote: "Video message",
  voice: "Voice message",
  audio: "Audio",
  document: "File",
  poll: "Poll",
  location: "Location",
  contact: "Contact",
  other: "Message",
};

/** What it is, in a few words: "Photo", "😂 Sticker", "Poll: Lunch?", "report.pdf" */
export function describeMedia(media: MediaAttachment): string {
  switch (media.type) {
    case "sticker":
      return [media.emoji, "Sticker"].filter(Boolean).join(" ");
    case "document":
      return media.fileName ?? MEDIA_NAMES.document;
    case "other":
      return [media.emoji, media.title ?? MEDIA_NAMES.other].filter(Boolean).join(" ");
    default: {
      const detail = media.title ?? (media.type === "audio" ? media.fileName : undefined);
      return detail ? `${MEDIA_NAMES[media.type]}: ${detail}` : MEDIA_NAMES[media.type];
    }
  }
}
