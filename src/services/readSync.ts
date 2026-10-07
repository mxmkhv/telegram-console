/** Tells Telegram how far you've read, so other devices agree */
export interface ReadSync {
  /** You've seen everything up to this message */
  seen(chatId: string, messageId: number): void;
  /** Drop what's waiting, e.g. on logout */
  stop(): void;
}

/**
 * Reading while scrolling reports often, so reports are gathered and sent at
 * most once per `delayMs`, and only when they move the position forward.
 * A report for another chat sends what was waiting right away.
 */
export function createReadSync(
  markAsRead: (chatId: string, maxMessageId: number) => Promise<boolean>,
  delayMs = 1000,
): ReadSync {
  // Sent, or on its way
  const sent = new Map<string, number>();
  let waiting: { chatId: string; messageId: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const send = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!waiting) return;
    const { chatId, messageId } = waiting;
    waiting = null;
    const before = sent.get(chatId);
    sent.set(chatId, messageId);
    // A rejection is a failure like any other
    void markAsRead(chatId, messageId).catch(() => false).then((ok) => {
      // Failed: the next report sends it again (unless something newer went since)
      if (!ok && sent.get(chatId) === messageId) {
        if (before === undefined) sent.delete(chatId);
        else sent.set(chatId, before);
      }
    });
  };

  return {
    seen(chatId, messageId) {
      // Unsent messages have negative ids
      if (messageId <= 0 || messageId <= (sent.get(chatId) ?? 0)) return;
      if (waiting && waiting.chatId !== chatId) send();
      if (waiting && waiting.messageId >= messageId) return;
      waiting = { chatId, messageId };
      timer ??= setTimeout(send, delayMs);
    },
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      waiting = null;
    },
  };
}
