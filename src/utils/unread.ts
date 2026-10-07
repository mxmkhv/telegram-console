import type { Chat } from "../types";

/** Unread messages across chats, leaving out muted ones like Telegram's badge does */
export function countUnread(chats: Chat[]): number {
  return chats.reduce((sum, chat) => sum + (chat.isMuted ? 0 : chat.unreadCount), 0);
}
