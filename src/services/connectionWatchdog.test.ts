import { describe, it, expect } from "bun:test";
import { createConnectionWatchdog, readConnectionReport } from "./connectionWatchdog";
import type { ConnectionState } from "../types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setup(results: Array<boolean | Error>, isRecovering?: () => boolean) {
  const states: ConnectionState[] = [];
  let tries = 0;
  const watchdog = createConnectionWatchdog({
    isRecovering,
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

  it("waits while the library is still reconnecting instead of calling it disconnected", async () => {
    let recovering = true;
    const { watchdog, states, tries } = setup([true], () => recovering);
    watchdog.lost();
    await wait(70);
    expect(states).toEqual(["connecting"]);
    expect(tries()).toBe(0);
    recovering = false;
    await wait(40);
    expect(states).toEqual(["connecting", "connected"]);
  });
});

describe("readConnectionReport", () => {
  const live = { wasConnected: true, reconnecting: false, connected: true };

  it("ignores the disconnected report GramJS sends for a slow pong", () => {
    expect(readConnectionReport(false, live)).toBe("ignore");
  });

  it("takes a report while reconnecting, or after letting go, as a drop", () => {
    expect(readConnectionReport(false, { ...live, reconnecting: true })).toBe("lost");
    expect(readConnectionReport(false, { ...live, connected: false })).toBe("lost");
  });

  it("leaves a failed first connect to connect()", () => {
    expect(readConnectionReport(false, { wasConnected: false, reconnecting: false, connected: false })).toBe("ignore");
  });

  it("takes connected as restored", () => {
    expect(readConnectionReport(true, live)).toBe("restored");
  });
});
