import { describe, it, expect } from "bun:test";
import { createReadSync } from "./readSync";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setup(results: boolean[] = [true]) {
  const calls: Array<[string, number]> = [];
  const sync = createReadSync(async (chatId, messageId) => {
    calls.push([chatId, messageId]);
    return results[Math.min(calls.length - 1, results.length - 1)]!;
  }, 20);
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

  it("sends the last chat's position right away on moving to another", async () => {
    const { sync, calls } = setup();
    sync.seen("a", 7);
    sync.seen("b", 2);
    expect(calls).toEqual([["a", 7]]);
    await wait(40);
    expect(calls).toEqual([["a", 7], ["b", 2]]);
  });

  it("tries again on the next report after a failure", async () => {
    const { sync, calls } = setup([false, true]);
    sync.seen("a", 7);
    await wait(40);
    sync.seen("a", 7);
    await wait(40);
    expect(calls).toEqual([["a", 7], ["a", 7]]);
  });

  it("ignores unsent messages and stops when told", async () => {
    const { sync, calls } = setup();
    sync.seen("a", -1);
    sync.seen("a", 4);
    sync.stop();
    await wait(40);
    expect(calls).toEqual([]);
  });
});
