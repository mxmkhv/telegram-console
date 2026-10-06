const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Calendar days from `date` to `now`: 0 today, 1 yesterday */
function daysAgo(date: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Separator label between days: "Today", "Yesterday", "Monday", "Mon, Oct 3", "Oct 3, 2024" */
export function formatDayLabel(date: Date, now = new Date()): string {
  const days = daysAgo(date, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Compact time for a chat row: "14:32" today, then "Yest", "Mon", "Oct 3", "10/3/24" */
export function formatChatTime(date: Date, now = new Date()): string {
  const days = daysAgo(date, now);
  if (days <= 0) return formatTime(date);
  if (days === 1) return "Yest";
  if (days < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
}
