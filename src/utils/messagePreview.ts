import type { MediaAttachment, Message } from "../types";

const MEDIA_LABELS: Record<MediaAttachment["type"], string> = {
  photo: "Photo",
  sticker: "Sticker",
  gif: "GIF",
  video: "Video",
  document: "File",
  voice: "Voice message",
};

/** One-line summary for the chat list: "You: on my way", "Alice: Photo" */
export function getMessagePreview(msg: Message, isGroup: boolean): string {
  const media = msg.media
    ? [msg.media.type === "sticker" ? msg.media.emoji : undefined, MEDIA_LABELS[msg.media.type]].filter(Boolean).join(" ")
    : "";
  const body = msg.text.replace(/\s+/g, " ").trim() || media;
  const sender = msg.isOutgoing ? "You" : isGroup ? msg.senderName.split(" ")[0] : "";
  return sender ? `${sender}: ${body}` : body;
}
