import { afterAll, beforeAll, describe, it, expect, mock } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { MediaPanel } from "./MediaPanel";
import type { Message, MediaAttachment } from "../types/index.js";
import type { Api } from "telegram";

// Mock the media services to avoid actual media loading
mock.module("../services/mediaCache.js", () => ({
  getMediaBuffer: async () => Buffer.from("mock"),
}));

mock.module("../services/imageRenderer.js", () => ({
  // Return an oversized render that grows with zoom, so panning has room.
  renderPanelImage: async (_b: Buffer, _w: number, _h: number, zoom = 1) =>
    Array.from({ length: Math.round(2 * zoom) }, () => "X".repeat(Math.round(10 * zoom))).join("\n"),
  formatMediaMetadata: () => "Photo 100x100 | 1KB",
}));

// Force the ANSI fallback path deterministically, keeping every other kittyImage
// export real. mock.module is process-wide, so the override is scoped to this
// file's tests and otherwise defers to the original (captured before mocking,
// since the mock patches the imported namespace in place).
let forceNoKitty = false;
const realKitty = await import("../services/kittyImage.js");
const { supportsKittyGraphics: realSupports } = realKitty;
mock.module("../services/kittyImage.js", () => ({
  ...realKitty,
  supportsKittyGraphics: (stream?: NodeJS.WriteStream) => (forceNoKitty ? false : realSupports(stream)),
}));

const mockMedia: MediaAttachment = {
  type: "photo",
  width: 100,
  height: 100,
  fileSize: 1024,
  _message: {} as Api.Message,
};

const mockMessage: Message = {
  id: 1,
  senderId: "user1",
  senderName: "Test User",
  text: "",
  timestamp: new Date("2024-01-01T12:00:00Z"),
  isOutgoing: false,
  media: mockMedia,
};

const mockDownloadMedia = async () => Buffer.from("mock");
const mockOnClose = () => {};

describe("MediaPanel", () => {
  beforeAll(() => {
    forceNoKitty = true;
  });
  afterAll(() => {
    forceNoKitty = false;
  });

  it("renders with cyan border when focused", () => {
    const { lastFrame } = render(
      <MediaPanel
        message={mockMessage}
        panelWidth={40}
        panelHeight={20}
        downloadMedia={mockDownloadMedia}
        onClose={mockOnClose}
        isFocused={true}
      />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders with blue border when unfocused", () => {
    const { lastFrame } = render(
      <MediaPanel
        message={mockMessage}
        panelWidth={40}
        panelHeight={20}
        downloadMedia={mockDownloadMedia}
        onClose={mockOnClose}
        isFocused={false}
      />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("defaults to focused state", () => {
    const { lastFrame } = render(
      <MediaPanel
        message={mockMessage}
        panelWidth={40}
        panelHeight={20}
        downloadMedia={mockDownloadMedia}
        onClose={mockOnClose}
      />
    );
    // Default isFocused=true should show cyan
    expect(lastFrame()).toMatchSnapshot();
  });

  it("cycles zoom on Space and reveals the pan hint when zoomed", async () => {
    const { lastFrame, stdin } = render(
      <MediaPanel
        message={mockMessage}
        panelWidth={60}
        panelHeight={20}
        downloadMedia={mockDownloadMedia}
        onClose={mockOnClose}
        isFocused={true}
      />
    );

    // Let the async download + render settle.
    await new Promise((r) => setTimeout(r, 20));
    expect(lastFrame()).toContain("(1.0×)");
    expect(lastFrame()).not.toContain("arrows pan"); // no pan at fit

    stdin.write(" "); // Space → next zoom level
    await new Promise((r) => setTimeout(r, 20));
    const frame = lastFrame();
    expect(frame).toContain("(1.5×)");
    expect(frame).toContain("arrows pan"); // pan hint appears once zoomed
  });

  it("closes on Escape", async () => {
    let closed = false;
    const { stdin } = render(
      <MediaPanel
        message={mockMessage}
        panelWidth={60}
        panelHeight={20}
        downloadMedia={mockDownloadMedia}
        onClose={() => { closed = true; }}
        isFocused={true}
      />
    );
    await new Promise((r) => setTimeout(r, 20));
    stdin.write("\x1B"); // Escape
    await new Promise((r) => setTimeout(r, 20)); // Ink debounces a bare ESC
    expect(closed).toBe(true);
  });
});
