/** Tells Telegram how far you've read, so other devices agree */
export interface ReadSync {
  /** You've seen everything up to this message */
  seen(chatId: string, messageId: number): void;
  /** Send what's waiting now, and stop: on quit or logout */
  close(): void;
}

/**
 * Reading while scrolling reports often, so each chat's reports are gathered
 * and sent at most once per `delayMs`, and only when they move its position
 * forward.
 *
 * A failed send (offline, rate limited) stays queued for its chat and is tried
 * again with growing pauses, up to `maxRetryMs`. It isn't reported: the status
 * bar already shows a dropped connection.
 */
export function createReadSync(
  markAsRead: (chatId: string, maxMessageId: number) => Promise<boolean>,
  delayMs = 1000,
  maxRetryMs = 60_000,
): ReadSync {
  // Sent, or on its way
  const sent = new Map<string, number>();
  const waiting = new Map<string, { messageId: number; timer: ReturnType<typeof setTimeout> }>();
  // Each chat's next pause after a failure
  const retryMs = new Map<string, number>();
  let closed = false;

  const queue = (chatId: string, messageId: number, pause: number) => {
    const entry = waiting.get(chatId);
    if (entry) entry.messageId = Math.max(entry.messageId, messageId);
    else waiting.set(chatId, { messageId, timer: setTimeout(() => send(chatId), pause) });
  };

  const send = (chatId: string) => {
    const entry = waiting.get(chatId);
    if (!entry) return;
    clearTimeout(entry.timer);
    waiting.delete(chatId);
    const { messageId } = entry;
    const before = sent.get(chatId);
    sent.set(chatId, messageId);
    markAsRead(chatId, messageId)
      .then((ok) => {
        if (!ok) throw new Error("Telegram didn't mark the messages read");
        retryMs.delete(chatId);
      })
      .catch(() => {
        // Something newer went since, and covers this
        if (sent.get(chatId) !== messageId) return;
        if (before === undefined) sent.delete(chatId);
        else sent.set(chatId, before);
        if (closed) return;
        const pause = Math.min((retryMs.get(chatId) ?? delayMs) * 2, maxRetryMs);
        retryMs.set(chatId, pause);
        queue(chatId, messageId, pause);
      });
  };

  return {
    seen(chatId, messageId) {
      // Unsent messages have negative ids
      if (closed || messageId <= 0 || messageId <= (sent.get(chatId) ?? 0)) return;
      queue(chatId, messageId, delayMs);
    },
    close() {
      closed = true;
      for (const chatId of [...waiting.keys()]) send(chatId);
    },
  };
}
