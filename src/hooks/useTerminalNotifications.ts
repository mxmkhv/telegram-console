import { useEffect, useRef } from "react";
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

/** One alert per burst: a busy group shouldn't ring for every message */
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
 */
export function useTerminalNotifications({
  write,
  telegramService,
  chats,
  viewingChatId,
  hidden,
  mode,
  env = process.env,
}: TerminalNotificationsOptions) {
  const unread = chats.reduce((sum, chat) => sum + (chat.isMuted ? 0 : chat.unreadCount), 0);

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

  const lastAlertAt = useRef(0);
  useEffect(
    () =>
      telegramService.onNewMessage((message, chatId) => {
        const { write: out, chats: allChats, viewingChatId: viewing, hidden: isHidden, mode: current, env: vars } =
          latest.current;
        if (!out || isHidden || current === "off" || message.isOutgoing || chatId === viewing) return;
        const chat = allChats.find((c) => c.id === chatId);
        if (chat?.isMuted) return;
        const now = Date.now();
        if (now - lastAlertAt.current < ALERT_COOLDOWN_MS) return;
        lastAlertAt.current = now;

        out(bell());
        const protocol = current === "all" ? detectDesktopNotify(vars) : null;
        if (protocol) {
          out(desktopNotification(protocol, chat?.title ?? message.senderName, getMessagePreview(message, chat?.isGroup ?? false)));
        }
      }),
    [telegramService],
  );
}
