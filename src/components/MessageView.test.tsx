import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { MessageView } from "./MessageView";
import { AppProvider } from "../state/context";
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
      />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders with unfocused state and messages", () => {
    const { lastFrame } = renderWithProvider(
      <MessageView
        isFocused={false}
        selectedChatTitle="Chat with Alice"
        messages={mockMessages}
        selectedIndex={1}
        width={50}
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
      />
    );
    // Snapshot will capture the styling including cyan color for "You"
    expect(lastFrame()).toMatchSnapshot();
  });
});
