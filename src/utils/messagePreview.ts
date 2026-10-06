import type { MediaAttachment, Message } from "../types";

const MEDIA_LABELS: Record<MediaAttachment["type"], string> = {
  photo: "Photo",
  sticker: "Sticker",
  gif: "GIF",
  video: "Video",
  document: "File",
  voice: "Voice message",
};

/** Collapse line breaks and runs of whitespace, so text fits a one-row cell */
export function flattenLines(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** One-line summary for the chat list: "You: on my way", "Alice: Photo" */
export function getMessagePreview(msg: Message, isGroup: boolean): string {
  const media = msg.media
    ? [msg.media.type === "sticker" ? msg.media.emoji : undefined, MEDIA_LABELS[msg.media.type]].filter(Boolean).join(" ")
    : "";
  // Service messages and unsupported media have neither text nor a label
  const body = flattenLines(msg.text) || media || "Message";
  const sender = msg.isOutgoing ? "You" : isGroup ? msg.senderName.split(" ")[0] : "";
  return sender ? `${sender}: ${body}` : body;
}
