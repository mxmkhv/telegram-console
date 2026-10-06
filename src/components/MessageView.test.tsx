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
