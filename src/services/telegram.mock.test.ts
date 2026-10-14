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

  it("onTyping unsubscribe actually stops delivery of scripted pings", async () => {
    // Drive the scripted typing loop with a tiny interval so this is deterministic
    // and fast (defaults are 8000/3000ms for real --mock use).
    const service = createMockTelegramService({ typingIntervalMs: 20, typingClearMs: 5 });
    let aTrue = 0;
    let bTrue = 0;
    const unsubA = service.onTyping((_chatId, isTyping) => { if (isTyping) aTrue++; });
    const unsubB = service.onTyping((_chatId, isTyping) => { if (isTyping) bTrue++; });
    expect(typeof unsubA).toBe("function");

    await service.connect();

    // Let at least one interval tick fire: both callbacks should receive a `true` ping.
    await new Promise((r) => setTimeout(r, 60));
    expect(aTrue).toBeGreaterThan(0);
    expect(bTrue).toBeGreaterThan(0);

    // Unsubscribe A; B stays subscribed.
    const aFrozenAt = aTrue;
    const bBeforeUnsub = bTrue;
    unsubA();

    // Let more ticks fire: B keeps receiving, A must NOT (its count stays frozen).
    await new Promise((r) => setTimeout(r, 60));
    expect(bTrue).toBeGreaterThan(bBeforeUnsub);
    expect(aTrue).toBe(aFrozenAt);

    unsubB();
    await service.disconnect();
  });

  it("downloads a static sticker as Telegram serves it", async () => {
    const service = createMockTelegramService();
    await service.connect();
    const messages = await service.getMessages("3");
    const sticker = messages.find((m) => m.media?.type === "sticker");
    expect(sticker).toBeDefined();
    const buffer = await service.downloadMedia(sticker!);
    expect(buffer?.toString("ascii", 8, 12)).toBe("WEBP");
    await service.disconnect();
  });
});
