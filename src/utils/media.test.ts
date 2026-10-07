import { describe, it, expect } from "bun:test";
import type { MediaAttachment } from "../types";
import { canViewMedia, describeMedia, needsPreviewFrame } from "./media";

const media = (fields: Omit<MediaAttachment, "_message">) => ({ ...fields, _message: {} as never });

describe("describeMedia", () => {
  it("names each kind, with what it's about", () => {
    expect(describeMedia(media({ type: "photo" }))).toBe("Photo");
    expect(describeMedia(media({ type: "sticker", emoji: "😂" }))).toBe("😂 Sticker");
    expect(describeMedia(media({ type: "poll", title: "Lunch?" }))).toBe("Poll: Lunch?");
    expect(describeMedia(media({ type: "document", fileName: "report.pdf" }))).toBe("report.pdf");
    expect(describeMedia(media({ type: "audio", fileName: "song.mp3" }))).toBe("Audio: song.mp3");
    expect(describeMedia(media({ type: "other", emoji: "🎲", title: "rolled 5" }))).toBe("🎲 rolled 5");
  });
});

describe("canViewMedia", () => {
  it("opens images and video previews, not files, polls or places", () => {
    expect(canViewMedia(media({ type: "photo" }))).toBe(true);
    expect(canViewMedia(media({ type: "video" }))).toBe(true);
    expect(canViewMedia(media({ type: "document", mimeType: "image/png" }))).toBe(true);
    expect(canViewMedia(media({ type: "document", mimeType: "application/pdf" }))).toBe(false);
    expect(canViewMedia(media({ type: "poll" }))).toBe(false);
    expect(canViewMedia(media({ type: "location" }))).toBe(false);
  });

  it("shows a still frame for video and animated stickers", () => {
    expect(needsPreviewFrame(media({ type: "gif" }))).toBe(true);
    expect(needsPreviewFrame(media({ type: "sticker", isAnimated: true }))).toBe(true);
    expect(needsPreviewFrame(media({ type: "sticker" }))).toBe(false);
    expect(needsPreviewFrame(media({ type: "photo" }))).toBe(false);
  });
});
