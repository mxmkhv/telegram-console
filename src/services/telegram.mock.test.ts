import { describe, it, expect } from "bun:test";
import { createMockTelegramService } from "./telegram.mock";

describe("MockTelegramService", () => {
  it("starts disconnected", () => {
    const service = createMockTelegramService();
    expect(service.getConnectionState()).toBe("disconnected");
  });

  it("connects and returns connected state", async () => {
    const service = createMockTelegramService();
    await service.connect();
    expect(service.getConnectionState()).toBe("connected");
  });

  it("returns mock chats", async () => {
    const service = createMockTelegramService();
    await service.connect();
    const chats = await service.getChats();
    expect(chats.length).toBeGreaterThan(0);
    expect(chats[0]).toHaveProperty("id");
    expect(chats[0]).toHaveProperty("title");
  });

  it("returns mock messages for a chat", async () => {
    const service = createMockTelegramService();
    await service.connect();
    const chats = await service.getChats();
    const messages = await service.getMessages(chats[0]!.id);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]).toHaveProperty("text");
  });

  it("sends a message and returns it", async () => {
    const service = createMockTelegramService();
    await service.connect();
    const message = await service.sendMessage("1", "Hello world");
    expect(message.text).toBe("Hello world");
    expect(message.isOutgoing).toBe(true);
  });

  it("notifies on connection state change", async () => {
    const service = createMockTelegramService();
    const states: string[] = [];
    service.onConnectionStateChange((state) => states.push(state));
    await service.connect();
    expect(states).toContain("connecting");
    expect(states).toContain("connected");
  });
});
