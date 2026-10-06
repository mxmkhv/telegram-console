import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { MessageView, countWrappedLines } from "./MessageView";
import { LOGO_COLS, LOGO_ROWS } from "./logoAssets";
import { AppProvider } from "../state/context";
import { SkinContext } from "./ui/SkinContext";
import type { Message } from "../types";

const mockMessages: Message[] = [
  {
    id: 1,
    senderId: "user1",
    senderName: "Alice",
    text: "Hello there!",
    timestamp: new Date("2024-01-15T10:30:00"),
    isOutgoing: false,
  },
  {
    id: 2,
    senderId: "me",
    senderName: "You",
    text: "Hi Alice!",
    timestamp: new Date("2024-01-15T10:31:00"),
    isOutgoing: true,
  },
  {
    id: 3,
    senderId: "user1",
    senderName: "Alice",
    text: "How are you doing today?",
    timestamp: new Date("2024-01-15T10:32:00"),
    isOutgoing: false,
  },
];

const mockDispatch = () => {};
const mockSendReaction = async (_chatId: string, _messageId: number, _emoji: string) => true;
const mockRemoveReaction = async (_chatId: string, _messageId: number) => true;
const mockRetryDelivery = () => {};
const mockLoadOlder = () => {};

function renderWithProvider(ui: React.ReactElement) {
  return render(<AppProvider>{ui}</AppProvider>);
}

describe("MessageView", () => {
  it("renders empty state when no chat selected", () => {
    const { lastFrame } = renderWithProvider(
      <MessageView
        isFocused={false}
        selectedChatTitle={null}
        messages={[]}
        selectedIndex={0}
        width={50}
        dispatch={mockDispatch}
        messageLayout="classic"
        isGroupChat={false}
        chatId={null}
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders empty state when focused", () => {
    const { lastFrame } = renderWithProvider(
      <MessageView
        isFocused={true}
        selectedChatTitle={null}
        messages={[]}
        selectedIndex={0}
        width={50}
        dispatch={mockDispatch}
        messageLayout="classic"
        isGroupChat={false}
        chatId={null}
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders messages when chat is selected", () => {
    const { lastFrame } = renderWithProvider(
      <MessageView
        isFocused={true}
        selectedChatTitle="Chat with Alice"
        messages={mockMessages}
        selectedIndex={0}
        width={50}
        dispatch={mockDispatch}
        messageLayout="classic"
        isGroupChat={false}
        chatId="chat1"
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("drops the round border under the claudeCode skin (default skin keeps it)", () => {
    const props = {
      isFocused: true,
      selectedChatTitle: "Chat with Alice",
      messages: mockMessages,
      selectedIndex: 0,
      width: 50,
      dispatch: mockDispatch,
      messageLayout: "classic" as const,
      isGroupChat: false,
      chatId: "chat1",
      sendReaction: mockSendReaction,
      removeReaction: mockRemoveReaction,
      onRetryDelivery: mockRetryDelivery,
      onLoadOlder: mockLoadOlder,
      reactionOverlay: null,
    };
    const defaultFrame = renderWithProvider(<MessageView {...props} />).lastFrame() ?? "";
    const claudeCodeFrame =
      render(
        <SkinContext.Provider value="claudeCode">
          <AppProvider>
            <MessageView {...props} />
          </AppProvider>
        </SkinContext.Provider>,
      ).lastFrame() ?? "";

    expect(defaultFrame).toContain("╭");
    expect(claudeCodeFrame).not.toContain("╭");
    expect(claudeCodeFrame).toContain("Chat with Alice");
  });

  it("renders with unfocused state and messages", () => {
    const { lastFrame } = renderWithProvider(
      <MessageView
        isFocused={false}
        selectedChatTitle="Chat with Alice"
        messages={mockMessages}
        selectedIndex={1}
        width={50}
        dispatch={mockDispatch}
        messageLayout="classic"
        isGroupChat={false}
        chatId="chat1"
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders outgoing message with cyan sender name", () => {
    const { lastFrame } = renderWithProvider(
      <MessageView
        isFocused={true}
        selectedChatTitle="Chat with Alice"
        messages={mockMessages}
        selectedIndex={1}
        width={50}
        dispatch={mockDispatch}
        messageLayout="classic"
        isGroupChat={false}
        chatId="chat1"
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />
    );
    // Snapshot will capture the styling including cyan color for "You"
    expect(lastFrame()).toMatchSnapshot();
  });

  it("smaller height reduces the visible message window", () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      senderId: "u1",
      senderName: "Alice",
      text: `msg ${i}`,
      timestamp: new Date(0),
      isOutgoing: false,
    }));
    const { lastFrame } = renderWithProvider(
      <MessageView
        isFocused
        selectedChatTitle="Chat"
        messages={messages}
        selectedIndex={29}
        width={50}
        height={10}
        dispatch={() => {}}
        messageLayout="classic"
        isGroupChat={false}
        chatId="1"
        sendReaction={async () => true}
        removeReaction={async () => true}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />,
    );
    const frame = lastFrame() ?? "";
    const shown = messages.filter((m) => frame.includes(m.text)).length;
    // height 10 → visibleLines 6; with a scroll-up indicator far fewer than 30 are shown
    expect(shown).toBeLessThan(30);
    expect(shown).toBeGreaterThan(0);
    // earlier messages are hidden, so the scroll-up indicator must appear
    expect(frame).toContain("earlier");
  });

  it("shows 'typing…' in the header when isTyping is true", () => {
    const { lastFrame } = renderWithProvider(
      <MessageView
        isFocused={false}
        selectedChatTitle="Alice"
        messages={[]}
        selectedIndex={0}
        width={40}
        height={10}
        dispatch={mockDispatch}
        messageLayout="classic"
        isGroupChat={false}
        chatId="123"
        isTyping={true}
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />
    );
    expect(lastFrame()).toContain("typing…");
  });

  it("does not show 'typing…' when isTyping is false", () => {
    const { lastFrame } = renderWithProvider(
      <MessageView
        isFocused={false}
        selectedChatTitle="Alice"
        messages={[]}
        selectedIndex={0}
        width={40}
        height={10}
        dispatch={mockDispatch}
        messageLayout="classic"
        isGroupChat={false}
        chatId="123"
        isTyping={false}
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />
    );
    expect(lastFrame()).not.toContain("typing…");
  });

  it("renders messages with reactions", () => {
    const messagesWithReactions: Message[] = [
      {
        id: 1,
        senderId: "user1",
        senderName: "Alice",
        text: "Hello there!",
        timestamp: new Date("2024-01-15T10:30:00"),
        isOutgoing: false,
        reactions: [
          { emoji: "👍", count: 2, hasUserReacted: false },
          { emoji: "❤️", count: 1, hasUserReacted: true },
        ],
      },
    ];

    const { lastFrame } = renderWithProvider(
      <MessageView
        isFocused={true}
        selectedChatTitle="Chat with Alice"
        messages={messagesWithReactions}
        selectedIndex={0}
        width={60}
        dispatch={mockDispatch}
        chatId="test-chat"
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
        messageLayout="classic"
        isGroupChat={false}
      />
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("👍");
    expect(frame).toContain("❤️");
  });
});

describe("countWrappedLines", () => {
  it("returns 1 for a line that fits", () => {
    expect(countWrappedLines("hello", 20)).toBe(1);
    expect(countWrappedLines("", 20)).toBe(1);
  });

  it("wraps on word boundaries (greedy)", () => {
    // "aaa bbb" = 7 fits; "ccc" wraps -> 2 rows
    expect(countWrappedLines("aaa bbb ccc", 7)).toBe(2);
  });

  it("hard-wraps a single word longer than the width", () => {
    // 10 chars at width 4 -> ceil(10/4) = 3 rows
    expect(countWrappedLines("abcdefghij", 4)).toBe(3);
  });

  it("never under-counts a realistic line", () => {
    // "Too late, already filed paperwork for xChat" at width 20 -> 3 rows
    expect(countWrappedLines("Too late, already filed paperwork for xChat", 20)).toBe(3);
  });

  it("counts leading whitespace and never under-counts", () => {
    // " abc" is 4 chars at width 3 -> at least 2 rows
    expect(countWrappedLines(" abc", 3)).toBe(2);
  });

  it("measures emoji and CJK in terminal columns", () => {
    // 6 characters, 12 columns
    expect(countWrappedLines("中文中文中文", 6)).toBe(2);
    expect(countWrappedLines("🚀🚀🚀", 4)).toBe(2);
  });

  it("starts a long word on the current row when Ink does", () => {
    expect(countWrappedLines("Tesla bb supercalifragilistic", 18)).toBe(2);
  });
});

describe("MessageView wide characters", () => {
  it("keeps the newest message visible when CJK text wraps", () => {
    const cjk = (id: number, text: string): Message => ({
      id,
      senderId: "user1",
      senderName: "Alice",
      text,
      timestamp: new Date("2024-01-15T10:30:00"),
      isOutgoing: false,
    });
    const messages = [cjk(1, "中文中文中文中文中文"), cjk(2, "中文中文中文中文中文"), cjk(3, "最后的消息最后的消息")];
    const { lastFrame } = renderWithProvider(
      <MessageView
        isFocused
        selectedChatTitle="Alice"
        messages={messages}
        selectedIndex={2}
        width={34}
        height={8}
        dispatch={mockDispatch}
        messageLayout="classic"
        isGroupChat={false}
        chatId="1"
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />,
    );
    expect(lastFrame()).toContain("最后的消息");
  });
});

describe("MessageView empty state logo", () => {
  const LOGO_INK = "⣿";

  function renderEmptyState(width: number, height: number) {
    return renderWithProvider(
      <MessageView
        isFocused={false}
        selectedChatTitle={null}
        messages={[]}
        selectedIndex={0}
        width={width}
        height={height}
        dispatch={mockDispatch}
        messageLayout="classic"
        isGroupChat={false}
        chatId={null}
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />
    ).lastFrame()!;
  }

  it("shows the logo above the hint when the panel has room", () => {
    const frame = renderEmptyState(LOGO_COLS + 6, LOGO_ROWS + 6);
    expect(frame).toContain(LOGO_INK);
    expect(frame.indexOf(LOGO_INK)).toBeLessThan(frame.indexOf("Select a chat to start"));
  });

  it("drops the logo but keeps the hint in a short panel", () => {
    const frame = renderEmptyState(80, LOGO_ROWS + 5);
    expect(frame).not.toContain(LOGO_INK);
    expect(frame).toContain("Select a chat to start");
  });

  it("drops the logo but keeps the hint in a narrow panel", () => {
    const frame = renderEmptyState(LOGO_COLS + 5, 30);
    expect(frame).not.toContain(LOGO_INK);
    expect(frame).toContain("Select a chat to start");
  });
});

describe("MessageView day separators", () => {
  const at = (id: number, date: Date, text: string): Message => ({
    id,
    senderId: "user1",
    senderName: "Alice",
    text,
    timestamp: date,
    isOutgoing: false,
  });

  it("labels each day once, sits on the bottom, and still fits", () => {
    const today = new Date();
    today.setHours(9, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const messages = [at(1, yesterday, "first"), at(2, yesterday, "second"), at(3, today, "third")];
    const { lastFrame } = renderWithProvider(
      <MessageView
        isFocused
        selectedChatTitle="Alice"
        messages={messages}
        selectedIndex={2}
        width={40}
        height={20}
        dispatch={mockDispatch}
        messageLayout="classic"
        isGroupChat={false}
        chatId="1"
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />,
    );
    const lines = (lastFrame() ?? "").split("\n");
    const row = (text: string) => lines.findIndex((line) => line.includes(text));
    expect(lines.filter((line) => line.includes("── Yesterday ──"))).toHaveLength(1);
    expect(row("── Yesterday ──")).toBe(row("first") - 1);
    expect(row("── Today ──")).toBe(row("third") - 1);
    // Newest message is the last row inside the border
    expect(row("third")).toBe(lines.length - 2);
  });
});

describe("MessageView load states", () => {
  const renderEmpty = (loadStatus: "loading" | "ready" | "error") =>
    renderWithProvider(
      <MessageView
        isFocused
        selectedChatTitle="Alice"
        messages={[]}
        selectedIndex={0}
        loadStatus={loadStatus}
        width={40}
        height={12}
        dispatch={mockDispatch}
        messageLayout="classic"
        isGroupChat={false}
        chatId="1"
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />,
    ).lastFrame() ?? "";

  it("tells loading, failed and empty chats apart", () => {
    expect(renderEmpty("loading")).toContain("Loading messages…");
    expect(renderEmpty("error")).toContain("Press Ctrl+R to retry");
    expect(renderEmpty("ready")).toContain("No messages yet");
  });
});

describe("MessageView paging", () => {
  it("PgUp and PgDn move by a screen of messages", async () => {
    const messages: Message[] = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      senderId: "user1",
      senderName: "Alice",
      text: `message ${i + 1}`,
      timestamp: new Date("2024-01-15T10:30:00"),
      isOutgoing: false,
    }));
    const moves: number[] = [];
    const { stdin } = renderWithProvider(
      <MessageView
        isFocused
        selectedChatTitle="Alice"
        messages={messages}
        selectedIndex={29}
        setSelectedIndex={(index) => moves.push(index)}
        width={40}
        height={12}
        dispatch={mockDispatch}
        messageLayout="classic"
        isGroupChat={false}
        chatId="1"
        sendReaction={mockSendReaction}
        removeReaction={mockRemoveReaction}
        onRetryDelivery={mockRetryDelivery}
        onLoadOlder={mockLoadOlder}
        reactionOverlay={null}
      />,
    );
    stdin.write("\x1b[5~");
    await new Promise((r) => setTimeout(r, 30));
    stdin.write("\x1b[6~");
    await new Promise((r) => setTimeout(r, 30));
    // 8 rows: the "↑ earlier" line + 7 messages, so a page is 6 (one message overlaps)
    expect(moves).toEqual([23, 29]);
  });
});

describe("MessageView load-older row", () => {
  it("budgets its own row instead of colliding with the day label", () => {
    const messages: Message[] = Array.from({ length: 7 }, (_, i) => ({
      id: i + 1,
      senderId: "user1",
      senderName: "Alice",
      text: `message ${i + 1}`,
      timestamp: new Date("2024-01-15T10:30:00"),
      isOutgoing: false,
    }));
    // 8 rows: exactly the day label + 7 messages, with no room for the load-older line
    const frame =
      renderWithProvider(
        <MessageView
          isFocused
          selectedChatTitle="Alice"
          messages={messages}
          selectedIndex={0}
          canLoadOlder
          width={50}
          height={12}
          dispatch={mockDispatch}
          messageLayout="classic"
          isGroupChat={false}
          chatId="1"
          sendReaction={mockSendReaction}
          removeReaction={mockRemoveReaction}
          onRetryDelivery={mockRetryDelivery}
          onLoadOlder={mockLoadOlder}
          reactionOverlay={null}
        />,
      ).lastFrame() ?? "";
    const lines = frame.split("\n");
    const older = lines.findIndex((l) => l.includes("Press Enter to load older messages"));
    expect(older).toBeGreaterThan(0);
    expect(lines[older + 1]).toContain("── Jan 15, 2024 ──");
    expect(lines[older + 2]).toContain("message 1");
  });
});

describe("MessageView review regressions", () => {
  const msg = (id: number, overrides: Partial<Message> = {}): Message => ({
    id,
    senderId: `user${id}`,
    senderName: "Alice",
    text: `message ${id}`,
    timestamp: new Date("2024-01-15T10:30:00"),
    isOutgoing: false,
    ...overrides,
  });
  const view = (props: Partial<React.ComponentProps<typeof MessageView>>) => (
    <MessageView
      isFocused
      selectedChatTitle="Group"
      messages={[]}
      selectedIndex={0}
      width={40}
      height={12}
      dispatch={mockDispatch}
      messageLayout="classic"
      isGroupChat={false}
      chatId="1"
      sendReaction={mockSendReaction}
      removeReaction={mockRemoveReaction}
      onRetryDelivery={mockRetryDelivery}
      onLoadOlder={mockLoadOlder}
      reactionOverlay={null}
      {...props}
    />
  );

  it("Ctrl+R and Ctrl+K don't also react or move the selection", async () => {
    const actions: string[] = [];
    const moves: number[] = [];
    const messages = [msg(1), msg(2), msg(3)];
    const { stdin } = renderWithProvider(
      view({
        messages,
        selectedIndex: 2,
        dispatch: (action) => actions.push(action.type),
        setSelectedIndex: (index) => moves.push(index),
      }),
    );
    stdin.write("\x12");
    stdin.write("\x0b");
    await new Promise((r) => setTimeout(r, 30));
    expect(actions).not.toContain("SET_REACTION_OVERLAY");
    expect(moves).toEqual([]);
  });

  it("long bubble names and reply names stay on one row", () => {
    const longName = "Alexander Konstantinopoulos-Smithson";
    const messages = Array.from({ length: 6 }, (_, i) =>
      msg(i + 1, { senderName: longName, replyToMsgId: i || undefined, replyToSenderName: longName }),
    );
    const frame =
      renderWithProvider(
        view({ messages, selectedIndex: 5, width: 30, messageLayout: "bubble", isGroupChat: true }),
      ).lastFrame() ?? "";
    expect(frame).toMatch(/↑ \d+ earlier/);
    expect(frame).toContain("message 6");
  });

  it("shows the start of a message taller than the panel", () => {
    const tall = msg(2, { text: Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n") });
    const frame = renderWithProvider(view({ messages: [msg(1), tall], selectedIndex: 1 })).lastFrame() ?? "";
    expect(frame).toContain("Alice: line 1");
  });

  it("renders tabs as spaces so lines stay inside the border", () => {
    const frame =
      renderWithProvider(view({ messages: [msg(1, { text: "a\tb" })], selectedIndex: 0 })).lastFrame() ?? "";
    expect(frame).toContain("a    b");
    expect(frame).not.toContain("\t");
  });
});

