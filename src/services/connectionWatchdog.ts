import type { ConnectionState } from "../types";

export interface ConnectionWatchdogOptions {
  /** Tries to connect again; resolves whether it worked. A rejection counts as a failed try. */
  reconnect: () => Promise<boolean>;
  onStateChange: (state: ConnectionState) => void;
  /** Time the client library gets to recover on its own before the watchdog steps in */
  graceMs?: number;
  /** Time between the watchdog's own tries */
  retryMs?: number;
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
  onStateChange,
  graceMs = 15_000,
  retryMs = 10_000,
}: ConnectionWatchdogOptions): ConnectionWatchdog {
  let dropped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const tryAfter = (ms: number) => {
    clear();
    timer = setTimeout(async () => {
      timer = null;
      if (!dropped) return;
      const ok = await reconnect().catch(() => false);
      // Restored meanwhile (by the library, or stopped)
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
