/** Tells Telegram how far you've read, so other devices agree */
export interface ReadSync {
  /** You've seen everything up to this message */
  seen(chatId: string, messageId: number): void;
  /** Send what's waiting now, and stop: on quit or logout */
  close(): void;
}

/**
 * Reading while scrolling reports often, so reports are gathered and sent at
 * most once per `delayMs`, and only when they move the position forward.
 * A report for another chat sends what was waiting right away.
 *
 * A failed send (offline, rate limited) is tried again with growing pauses,
 * up to `maxRetryMs`. It isn't reported: the status bar already shows a
 * dropped connection, and the next read covers anything older.
 */
export function createReadSync(
  markAsRead: (chatId: string, maxMessageId: number) => Promise<boolean>,
  delayMs = 1000,
  maxRetryMs = 60_000,
): ReadSync {
  // Sent, or on its way
  const sent = new Map<string, number>();
  let waiting: { chatId: string; messageId: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retryMs = delayMs;
  let closed = false;

  const send = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!waiting) return;
    const { chatId, messageId } = waiting;
    waiting = null;
    const before = sent.get(chatId);
    sent.set(chatId, messageId);
    markAsRead(chatId, messageId)
      .then((ok) => {
        if (!ok) throw new Error("Telegram didn't mark the messages read");
        retryMs = delayMs;
      })
      .catch(() => {
        // Something newer went since, and covers this
        if (sent.get(chatId) !== messageId) return;
        if (before === undefined) sent.delete(chatId);
        else sent.set(chatId, before);
        // Another chat's position is waiting: this one goes out next time you read here
        if (closed || waiting) return;
        waiting = { chatId, messageId };
        retryMs = Math.min(retryMs * 2, maxRetryMs);
        timer = setTimeout(send, retryMs);
      });
  };

  return {
    seen(chatId, messageId) {
      // Unsent messages have negative ids
      if (closed || messageId <= 0 || messageId <= (sent.get(chatId) ?? 0)) return;
      if (waiting && waiting.chatId !== chatId) send();
      if (waiting && waiting.messageId >= messageId) return;
      waiting = { chatId, messageId };
      timer ??= setTimeout(send, delayMs);
    },
    close() {
      closed = true;
      send();
    },
  };
}
