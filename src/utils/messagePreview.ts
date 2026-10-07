import type { Message } from "../types";
import { describeMedia } from "./media";

/** Collapse line breaks and runs of whitespace, so text fits a one-row cell */
export function flattenLines(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** One-line summary for the chat list: "You: on my way", "Alice: Photo" */
export function getMessagePreview(msg: Message, isGroup: boolean): string {
  // Service messages have neither text nor media
  const body = flattenLines(msg.text) || (msg.media && flattenLines(describeMedia(msg.media))) || "Message";
  const sender = msg.isOutgoing ? "You" : isGroup ? msg.senderName.split(" ")[0] : "";
  return sender ? `${sender}: ${body}` : body;
}
