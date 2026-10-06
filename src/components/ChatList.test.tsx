import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { ChatList } from "./ChatList";
import { SkinContext } from "./ui/SkinContext";
import type { Chat } from "../types";

const mockChats: Chat[] = [
  {
    id: "1",
    title: "John Doe",
    unreadCount: 0,
    isGroup: false,
  },
  {
    id: "2",
    title: "Jane Smith",
    unreadCount: 3,
    isGroup: false,
  },
  {
    id: "3",
    title: "Work Group",
    unreadCount: 0,
    isGroup: true,
  },
];

describe("ChatList", () => {
  it("renders correctly when focused", () => {
    const { lastFrame } = render(
      <ChatList
        status="ready"
        chats={mockChats}
        selectedChatId="1"
        onSelectChat={() => {}}
        selectedIndex={0}
        isFocused={true}
      />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders correctly when unfocused", () => {
    const { lastFrame } = render(
      <ChatList
        status="ready"
        chats={mockChats}
        selectedChatId="1"
        onSelectChat={() => {}}
        selectedIndex={0}
        isFocused={false}
      />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders chat with unread indicator in cyan", () => {
    const { lastFrame } = render(
      <ChatList
        status="ready"
        chats={mockChats}
        selectedChatId="2"
        onSelectChat={() => {}}
        selectedIndex={1}
        isFocused={true}
      />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders empty chat list", () => {
    const { lastFrame } = render(
      <ChatList
        status="ready"
        chats={[]}
        selectedChatId={null}
        onSelectChat={() => {}}
        selectedIndex={0}
        isFocused={true}
      />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("smaller height shows fewer chat rows", () => {
    const chats = Array.from({ length: 40 }, (_, i) => ({
      id: String(i),
      title: `Chat ${i}`,
      unreadCount: 0,
      isGroup: false,
    }));
    const { lastFrame } = render(
      <ChatList status="ready" chats={chats} selectedChatId={null} onSelectChat={() => {}} selectedIndex={0} isFocused height={12} />,
    );
    const frame = lastFrame() ?? "";
    const rowCount = chats.filter((c) => frame.includes(c.title)).length;
    // height 12 → LIST_HEIGHT 6 visible rows, far fewer than 40
    expect(rowCount).toBeLessThanOrEqual(6);
    expect(rowCount).toBeGreaterThan(0);
  });

  it("renders the container at the given width", () => {
    const chats = [{ id: "1", title: "Alpha", unreadCount: 0, isGroup: false }];
    const wide = render(
      <ChatList status="ready" chats={chats} selectedChatId={null} onSelectChat={() => {}} selectedIndex={0} isFocused={false} />
    ).lastFrame() ?? "";
    expect(wide.split("\n")[0]!.length).toBe(35); // default width

    const narrowBox = render(
      <ChatList status="ready" chats={chats} selectedChatId={null} onSelectChat={() => {}} selectedIndex={0} isFocused={false} width={20} />
    ).lastFrame() ?? "";
    expect(narrowBox.split("\n")[0]!.length).toBe(20);
  });

  it("drops the round border for a right-edge divider under the claudeCode skin (default skin keeps it)", () => {
    const chats = [{ id: "1", title: "Alpha", unreadCount: 0, isGroup: false }];
    const defaultFrame =
      render(
        <ChatList status="ready" chats={chats} selectedChatId={null} onSelectChat={() => {}} selectedIndex={0} isFocused={true} />
      ).lastFrame() ?? "";
    const claudeCodeFrame =
      render(
        <SkinContext.Provider value="claudeCode">
          <ChatList status="ready" chats={chats} selectedChatId={null} onSelectChat={() => {}} selectedIndex={0} isFocused={true} />
        </SkinContext.Provider>,
      ).lastFrame() ?? "";

    expect(defaultFrame).toContain("╭");
    expect(claudeCodeFrame).not.toContain("╭");
    // Still width-35 (the default), just framed by a single right-edge "│" divider instead.
    expect(claudeCodeFrame.split("\n")[0]!.length).toBe(35);
    expect(claudeCodeFrame).toContain("│");
  });

  it("shows a … marker for a chat that is typing", () => {
    const chats = [
      { id: "1", title: "Alice", unreadCount: 0, isGroup: false },
      { id: "2", title: "Bob", unreadCount: 0, isGroup: false },
    ];
    const { lastFrame } = render(
      <ChatList
        status="ready"
        chats={chats}
        selectedChatId={"1"}
        onSelectChat={() => {}}
        selectedIndex={0}
        isFocused={false}
        height={24}
        width={35}
        typingChats={{ "2": true }}
      />
    );
    const frame = lastFrame() ?? "";
    expect(frame.match(/typing…/g)).toHaveLength(1);
    const lines = frame.split("\n");
    expect(lines[lines.findIndex((l) => l.includes("Bob")) + 1]).toContain("typing…");
  });

  it("previews the draft of inactive chats", () => {
    const chats = [
      { id: "1", title: "Alice", unreadCount: 0, isGroup: false },
      { id: "2", title: "Bob", unreadCount: 0, isGroup: false },
    ];
    const draft = { text: "hi", replyTo: null, editing: null };
    const frame =
      render(
        <ChatList
          status="ready"
          chats={chats}
          selectedChatId={"1"}
          onSelectChat={() => {}}
          selectedIndex={0}
          isFocused={false}
          drafts={{ "1": draft, "2": draft }}
        />
      ).lastFrame() ?? "";
    // The open chat's draft is live in the input, so only Bob's shows
    expect(frame.match(/✎ Draft: hi/g)).toHaveLength(1);
    const lines = frame.split("\n");
    expect(lines[lines.findIndex((l) => l.includes("Bob")) + 1]).toContain("✎ Draft: hi");
  });

  // Titles truncate by display width, so markers survive long, wide (CJK)
  // titles and the narrower list used at small terminal widths.
  for (const width of [35, 30]) {
    it(`keeps the draft and unread count visible for long titles at width ${width}`, () => {
      const chats = [
        { id: "1", title: "Alice", unreadCount: 0, isGroup: false },
        {
          id: "2",
          title: "A Very Long Group Chat Title Here",
          unreadCount: 99,
          isGroup: true,
          lastMessage: {
            id: 1,
            senderId: "u1",
            senderName: "Alice",
            text: "hello",
            timestamp: new Date(new Date().setHours(16, 45)),
            isOutgoing: false,
          },
        },
        { id: "3", title: "技术交流群技术交流群技术交流群", unreadCount: 0, isGroup: true },
      ];
      const draft = { text: "hi", replyTo: null, editing: null };
      const frame =
        render(
          <ChatList
            status="ready"
            chats={chats}
            selectedChatId={"1"}
            onSelectChat={() => {}}
            selectedIndex={0}
            isFocused={false}
            width={width}
            drafts={{ "2": draft, "3": draft }}
          />
        ).lastFrame() ?? "";
      const lines = frame.split("\n");
      const latin = lines.findIndex((l) => l.includes("A Very Long"));
      const cjk = lines.findIndex((l) => l.includes("技术"));
      expect(lines[latin]).toMatch(/… 16:45 │$/);
      expect(lines[latin + 1]).toMatch(/✎ Draft: hi +99 │$/);
      expect(lines[cjk + 1]).toMatch(/✎ Draft: hi +│$/);
      for (const line of lines) expect(Bun.stringWidth(line)).toBe(width);
    });
  }
});

