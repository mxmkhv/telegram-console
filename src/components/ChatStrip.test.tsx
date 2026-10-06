import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { ChatStrip } from "./ChatStrip";
import { SkinContext } from "./ui/SkinContext";
import type { Chat } from "../types";

const makeChats = (n: number): Chat[] =>
  Array.from({ length: n }, (_, i) => ({
    id: String(i),
    title: `Chat${i}`,
    unreadCount: 0,
    isGroup: false,
  }));

describe("ChatStrip", () => {
  it("shows a 3-chat window centered on the selection", () => {
    const frame =
      render(
        <ChatStrip status="ready" chats={makeChats(6)} selectedIndex={3} selectedChatId="3" isFocused />
      ).lastFrame() ?? "";
    expect(frame).toContain("Chat2");
    expect(frame).toContain("Chat3");
    expect(frame).toContain("Chat4");
    expect(frame).not.toContain("Chat0");
    expect(frame).not.toContain("Chat5");
  });

  it("marks the active chat with ▸ and shows overflow affordances", () => {
    const frame =
      render(
        <ChatStrip status="ready" chats={makeChats(6)} selectedIndex={3} selectedChatId="3" isFocused />
      ).lastFrame() ?? "";
    expect(frame).toContain("▸Chat3");
    expect(frame).toContain("‹");
    expect(frame).toContain("›");
  });

  it("omits the caret glyph before the active chat under the claudeCode skin (default skin keeps it)", () => {
    const frame =
      render(
        <SkinContext.Provider value="claudeCode">
          <ChatStrip status="ready" chats={makeChats(6)} selectedIndex={3} selectedChatId="3" isFocused />
        </SkinContext.Provider>
      ).lastFrame() ?? "";
    expect(frame).toContain("Chat3");
    expect(frame).not.toContain("❯Chat3");
    expect(frame).not.toContain("❯");
  });

  it("renders a placeholder when there are no chats", () => {
    const frame =
      render(
        <ChatStrip status="ready" chats={[]} selectedIndex={0} selectedChatId={null} isFocused />
      ).lastFrame() ?? "";
    expect(frame).toContain("No chats");
  });

  it("says when chats are loading or failed to load", () => {
    const loading = render(<ChatStrip status="loading" chats={[]} selectedIndex={0} selectedChatId={null} isFocused />);
    expect(loading.lastFrame()).toContain("Loading chats…");
    const failed = render(<ChatStrip status="error" chats={[]} selectedIndex={0} selectedChatId={null} isFocused />);
    expect(failed.lastFrame()).toContain("Couldn't load chats · ^R retry");
  });

  it("shows a … marker for a chat that is typing", () => {
    const chats = [
      { id: "1", title: "Alice", unreadCount: 0, isGroup: false },
      { id: "2", title: "Bob", unreadCount: 0, isGroup: false },
    ];
    const frame =
      render(
        <ChatStrip
          status="ready"
          chats={chats}
          selectedIndex={0}
          selectedChatId={"1"}
          isFocused={false}
          typingChats={{ "2": true }}
        />
      ).lastFrame() ?? "";
    expect(frame).toContain("…Bob");
  });

  it("marks inactive chats with a draft with ✎", () => {
    const chats = [
      { id: "1", title: "Alice", unreadCount: 0, isGroup: false },
      { id: "2", title: "Bob", unreadCount: 0, isGroup: false },
    ];
    const draft = { text: "hi", replyTo: null, editing: null };
    const frame =
      render(
        <ChatStrip
          status="ready"
          chats={chats}
          selectedIndex={0}
          selectedChatId={"1"}
          isFocused={false}
          drafts={{ "1": draft, "2": draft }}
        />
      ).lastFrame() ?? "";
    expect(frame).toContain("✎Bob");
    expect(frame).not.toContain("✎Alice");
  });
});

