import type { ConnectionState } from "../types";

export interface ConnectionWatchdogOptions {
  /**
   * Tries to connect again; resolves whether it worked. A rejection is a failed
   * try too: while offline that's the expected outcome, shown as disconnected.
   */
  reconnect: () => Promise<boolean>;
  /** The library is mid-reconnect: wait for it rather than calling it disconnected */
  isRecovering?: () => boolean;
  onStateChange: (state: ConnectionState) => void;
  /** Time the client library gets to recover on its own before the watchdog steps in */
  graceMs?: number;
  /** Time between the watchdog's own tries */
  retryMs?: number;
}

/**
 * What a GramJS connection report means. It also reports "disconnected" for
 * any pong slower than 1s, then "connected" right after, without reconnecting:
 * only a report while it's actually reconnecting (or has let go) is a drop. A
 * failed first connect is connect()'s to report, so only drops once connected count.
 */
export function readConnectionReport(
  reportsConnected: boolean,
  client: { wasConnected: boolean; reconnecting: boolean; connected: boolean },
): "restored" | "lost" | "ignore" {
  if (reportsConnected) return "restored";
  if (client.wasConnected && (client.reconnecting || !client.connected)) return "lost";
  return "ignore";
}

export interface ConnectionWatchdog {
  /** The connection dropped: show it, and keep trying until it's back */
  lost(): void;
  /** The connection is back */
  restored(): void;
  /** Stop trying, e.g. on logout */
  stop(): void;
}

/**
 * GramJS reconnects by itself a few times after a drop, then gives up for good
 * without saying so. The watchdog shows the drop and keeps trying after that.
 */
export function createConnectionWatchdog({
  reconnect,
  isRecovering = () => false,
  onStateChange,
  graceMs = 15_000,
  retryMs = 10_000,
}: ConnectionWatchdogOptions): ConnectionWatchdog {
  let dropped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // One try at a time: a drop right after a restore mustn't start a second
  let trying = false;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const tryAfter = (ms: number) => {
    clear();
    timer = setTimeout(async () => {
      timer = null;
      if (!dropped) return;
      if (isRecovering() || trying) {
        tryAfter(retryMs);
        return;
      }
      trying = true;
      const ok = await reconnect().catch(() => false);
      trying = false;
      // Restored meanwhile (by the library), or stopped
      if (!dropped) return;
      if (ok) {
        dropped = false;
        onStateChange("connected");
        return;
      }
      // Still down: say so, and try again
      onStateChange("disconnected");
      tryAfter(retryMs);
    }, ms);
  };

  return {
    lost() {
      if (dropped) return;
      dropped = true;
      onStateChange("connecting");
      tryAfter(graceMs);
    },
    restored() {
      const wasDropped = dropped;
      dropped = false;
      clear();
      if (wasDropped) onStateChange("connected");
    },
    stop() {
      dropped = false;
      clear();
    },
  };
}
