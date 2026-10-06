import { describe, it, expect, afterEach } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { useTerminalNotifications } from "./useTerminalNotifications";
import { createMockTelegramService } from "../services/telegram.mock";
import type { Chat, NotificationMode } from "../types";

const chats: Chat[] = [
  { id: "1", title: "Elon Musk", unreadCount: 0, isGroup: false },
  { id: "4", title: "Tech Bros", unreadCount: 0, isGroup: true },
];
const svc = createMockTelegramService();
afterEach(() => svc.disconnect());
const wait = () => new Promise((r) => setTimeout(r, 20));

function Harness({ writes, mode }: { writes: string[]; mode: NotificationMode }) {
  useTerminalNotifications({
    write: (data) => writes.push(data),
    telegramService: svc,
    chats,
    viewingChatId: null,
    hidden: false,
    mode,
    env: { TERM_PROGRAM: "iTerm.app" },
  });
  return null;
}

describe("useTerminalNotifications", () => {
  it("shows who wrote and a preview, with the sender's name in groups", async () => {
    const writes: string[] = [];
    render(<Harness writes={writes} mode="all" />);
    svc.simulateIncomingMessage("4", "Lunch?\nAnyone");
    await wait();
    expect(writes).toContain("\x1b]9;Tech Bros: Tech: Lunch? Anyone\x07");
  });

  it("rings once for a burst of messages", async () => {
    const writes: string[] = [];
    render(<Harness writes={writes} mode="all" />);
    svc.simulateIncomingMessage("1", "one");
    svc.simulateIncomingMessage("1", "two");
    await wait();
    expect(writes.filter((w) => w === "\x07")).toHaveLength(1);
    expect(writes.filter((w) => w.startsWith("\x1b]9;"))).toHaveLength(1);
  });

  it("only rings in bell mode", async () => {
    const writes: string[] = [];
    render(<Harness writes={writes} mode="bell" />);
    svc.simulateIncomingMessage("1", "hello");
    await wait();
    expect(writes).toContain("\x07");
    expect(writes.some((w) => w.startsWith("\x1b]9;"))).toBe(false);
  });
});
