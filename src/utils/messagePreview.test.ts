import { describe, it, expect } from "bun:test";
import { getMessagePreview } from "./messagePreview";
import type { Message } from "../types";

const msg = (overrides: Partial<Message>): Message => ({
  id: 1,
  senderId: "u1",
  senderName: "Alice Smith",
  text: "",
  timestamp: new Date(),
  isOutgoing: false,
  ...overrides,
});

describe("getMessagePreview", () => {
  it("names the sender in groups and for your own messages only", () => {
    expect(getMessagePreview(msg({ text: "hi" }), false)).toBe("hi");
    expect(getMessagePreview(msg({ text: "hi" }), true)).toBe("Alice: hi");
    expect(getMessagePreview(msg({ text: "hi", isOutgoing: true }), false)).toBe("You: hi");
  });

  it("flattens multiline text onto one line", () => {
    expect(getMessagePreview(msg({ text: "line one\n\nline  two" }), false)).toBe("line one line two");
  });

  it("describes media without a caption", () => {
    const _message = {} as never;
    expect(getMessagePreview(msg({ media: { type: "photo", _message } }), false)).toBe("Photo");
    expect(getMessagePreview(msg({ media: { type: "sticker", emoji: "😂", _message } }), false)).toBe("😂 Sticker");
    expect(getMessagePreview(msg({ text: "look", media: { type: "photo", _message } }), false)).toBe("look");
  });
});
