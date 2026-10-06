import { describe, it, expect } from "bun:test";
import { createConnectionWatchdog } from "./connectionWatchdog";
import type { ConnectionState } from "../types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setup(results: Array<boolean | Error>) {
  const states: ConnectionState[] = [];
  let tries = 0;
  const watchdog = createConnectionWatchdog({
    reconnect: async () => {
      const result = results[Math.min(tries++, results.length - 1)]!;
      if (result instanceof Error) throw result;
      return result;
    },
    onStateChange: (state) => states.push(state),
    graceMs: 20,
    retryMs: 20,
  });
  return { watchdog, states, tries: () => tries };
}

describe("createConnectionWatchdog", () => {
  it("shows the drop and leaves the library time to recover", async () => {
    const { watchdog, states, tries } = setup([true]);
    watchdog.lost();
    expect(states).toEqual(["connecting"]);
    watchdog.restored();
    await wait(40);
    expect(states).toEqual(["connecting", "connected"]);
    expect(tries()).toBe(0);
  });

  it("keeps trying after the library gives up, showing it's disconnected", async () => {
    const { watchdog, states, tries } = setup([false, new Error("offline"), true]);
    watchdog.lost();
    await wait(110);
    expect(states).toEqual(["connecting", "disconnected", "disconnected", "connected"]);
    expect(tries()).toBe(3);
  });

  it("reports a drop once, however many times the library does", () => {
    const { watchdog, states } = setup([true]);
    watchdog.lost();
    watchdog.lost();
    expect(states).toEqual(["connecting"]);
    watchdog.stop();
  });

  it("stops trying when stopped", async () => {
    const { watchdog, states, tries } = setup([false]);
    watchdog.lost();
    watchdog.stop();
    await wait(60);
    expect(states).toEqual(["connecting"]);
    expect(tries()).toBe(0);
  });

  it("ignores a restore without a drop", () => {
    const { watchdog, states } = setup([true]);
    watchdog.restored();
    expect(states).toEqual([]);
  });
});
