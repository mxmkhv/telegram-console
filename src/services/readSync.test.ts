import { describe, it, expect } from "bun:test";
import { createReadSync } from "./readSync";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Each send succeeds, resolves false or throws, in turn; the last one repeats
function setup(results: Array<boolean | Error> = [true]) {
  const calls: Array<[string, number]> = [];
  const sync = createReadSync(async (chatId, messageId) => {
    calls.push([chatId, messageId]);
    const result = results[Math.min(calls.length - 1, results.length - 1)]!;
    if (result instanceof Error) throw result;
    return result;
  }, 20, 50);
  return { sync, calls };
}

describe("createReadSync", () => {
  it("sends the furthest position once while scrolling", async () => {
    const { sync, calls } = setup();
    sync.seen("a", 5);
    sync.seen("a", 7);
    sync.seen("a", 6);
    expect(calls).toEqual([]);
    await wait(40);
    expect(calls).toEqual([["a", 7]]);
  });

  it("doesn't send what's already read", async () => {
    const { sync, calls } = setup();
    sync.seen("a", 7);
    await wait(40);
    sync.seen("a", 7);
    sync.seen("a", 3);
    await wait(40);
    expect(calls).toEqual([["a", 7]]);
  });

  it("sends each chat's position", async () => {
    const { sync, calls } = setup();
    sync.seen("a", 7);
    sync.seen("b", 2);
    sync.seen("a", 8);
    await wait(40);
    expect(calls).toEqual([["a", 8], ["b", 2]]);
  });

  it("keeps a chat's failed position while you read another", async () => {
    const calls: Array<[string, number]> = [];
    let failA = true;
    const sync = createReadSync(async (chatId, messageId) => {
      calls.push([chatId, messageId]);
      if (chatId === "a" && failA) throw new Error("offline");
      return true;
    }, 20, 50);
    sync.seen("a", 7);
    await wait(10);
    sync.seen("b", 2);
    await wait(15);
    // a failed while b was waiting
    failA = false;
    await wait(80);
    expect(calls).toEqual([["a", 7], ["b", 2], ["a", 7]]);
  });

  it("tries again after a failure, waiting longer each time", async () => {
    const { sync, calls } = setup([new Error("offline"), false, true]);
    sync.seen("a", 7);
    // Sent at 20ms, then again 40ms and 50ms (the cap) after each failure
    await wait(70);
    expect(calls).toEqual([["a", 7], ["a", 7]]);
    await wait(60);
    expect(calls).toEqual([["a", 7], ["a", 7], ["a", 7]]);
    await wait(80);
    expect(calls).toHaveLength(3);
  });

  it("drops a failed retry once something newer is sent", async () => {
    let fail = true;
    const calls: number[] = [];
    const sync = createReadSync(async (_chatId, messageId) => {
      calls.push(messageId);
      if (fail) throw new Error("offline");
      return true;
    }, 20, 1000);
    sync.seen("a", 7);
    await wait(30);
    fail = false;
    sync.seen("a", 9);
    await wait(40);
    expect(calls).toEqual([7, 9]);
  });

  it("ignores unsent messages", async () => {
    const { sync, calls } = setup();
    sync.seen("a", -1);
    await wait(40);
    expect(calls).toEqual([]);
  });

  it("sends what's waiting on close, and nothing after", async () => {
    const { sync, calls } = setup([new Error("offline")]);
    sync.seen("a", 4);
    sync.seen("b", 3);
    sync.close();
    expect(calls).toEqual([["a", 4], ["b", 3]]);
    sync.seen("a", 5);
    await wait(120);
    expect(calls).toEqual([["a", 4], ["b", 3]]);
  });
});
