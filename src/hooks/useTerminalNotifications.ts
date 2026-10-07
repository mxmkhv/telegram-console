import { useEffect, useRef, useState } from "react";
import type { Chat, NotificationMode, TelegramService } from "../types";
import {
  bell,
  desktopNotification,
  detectDesktopNotify,
  popTitle,
  pushTitle,
  setTitle,
} from "../services/terminalNotify";
import { getMessagePreview } from "../utils/messagePreview";
import { countUnread } from "../utils/unread";

/** One bell per burst, and one notification per chat per burst */
export const ALERT_COOLDOWN_MS = 2000;
const APP_TITLE = "telegram-console";

interface TerminalNotificationsOptions {
  /** Writes escape sequences to the terminal; without one (tests) nothing is written */
  write: ((data: string) => void) | undefined;
  telegramService: TelegramService;
  chats: Chat[];
  /** The chat on screen; its messages need no alert */
  viewingChatId: string | null;
  /** Hidden mode stays quiet: no alerts, and the window title goes back to what it was */
  hidden: boolean;
  mode: NotificationMode;
  env?: Record<string, string | undefined>;
}

/**
 * The unread count in the window title, and a bell plus a desktop
 * notification for new messages in other chats. Muted chats are left out.
 * Returns how many messages arrived while hidden, for hidden mode's hint.
 */
export function useTerminalNotifications({
  write,
  telegramService,
  chats,
  viewingChatId,
  hidden,
  mode,
  env = process.env,
}: TerminalNotificationsOptions): { newWhileHidden: number } {
  const unread = countUnread(chats);

  // Counted from arrivals, not unread totals: those also drop when you read
  // elsewhere, and don't rise for the chat that's open
  const [newWhileHidden, setNewWhileHidden] = useState(0);
  const [wasHidden, setWasHidden] = useState(hidden);
  if (hidden !== wasHidden) {
    setWasHidden(hidden);
    if (hidden) setNewWhileHidden(0);
  }

  // Save the title on the way in and restore it on the way out (and while hidden)
  useEffect(() => {
    if (!write || hidden) return;
    write(pushTitle());
    return () => write(popTitle());
  }, [write, hidden]);

  useEffect(() => {
    if (!write || hidden) return;
    write(setTitle(unread > 0 ? `(${unread}) ${APP_TITLE}` : APP_TITLE));
  }, [write, hidden, unread]);

  // The subscription reads the latest values without resubscribing
  const latest = useRef({ write, chats, viewingChatId, hidden, mode, env });
  useEffect(() => {
    latest.current = { write, chats, viewingChatId, hidden, mode, env };
  });

  const lastBellAt = useRef(0);
  const lastNotifiedAt = useRef(new Map<string, number>());
  useEffect(
    () =>
      telegramService.onNewMessage((message, chatId) => {
        const { write: out, chats: allChats, viewingChatId: viewing, hidden: isHidden, mode: current, env: vars } =
          latest.current;
        if (message.isOutgoing) return;
        const chat = allChats.find((c) => c.id === chatId);
        if (chat?.isMuted) return;
        if (isHidden) {
          setNewWhileHidden((n) => n + 1);
          return;
        }
        if (!out || current === "off" || chatId === viewing) return;

        const now = Date.now();
        if (now - lastBellAt.current >= ALERT_COOLDOWN_MS) {
          lastBellAt.current = now;
          out(bell());
        }
        const protocol = current === "all" ? detectDesktopNotify(vars) : null;
        if (protocol && now - (lastNotifiedAt.current.get(chatId) ?? 0) >= ALERT_COOLDOWN_MS) {
          lastNotifiedAt.current.set(chatId, now);
          out(desktopNotification(protocol, chat?.title ?? message.senderName, getMessagePreview(message, chat?.isGroup ?? false)));
        }
      }),
    [telegramService],
  );

  return { newWhileHidden };
}
