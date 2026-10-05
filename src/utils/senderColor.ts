// Excludes blue (you), red (errors), cyan (focus accent) and their bright variants.
export const SENDER_COLORS = [
  "green",
  "yellow",
  "magenta",
  "white",
  "greenBright",
  "yellowBright",
  "magentaBright",
] as const;

export type SenderColor = (typeof SENDER_COLORS)[number];
export type SenderColors = Readonly<Record<string, SenderColor>>;

// FNV-1a: tiny, fast, and well distributed for short ids.
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function preferredColorIndex(senderId: string): number {
  return hashString(senderId) % SENDER_COLORS.length;
}

// Stateless hashed color: the render fallback for senders without an assigned
// color, and what assignSenderColors picks once the palette is full.
export function getSenderColor(senderId: string): SenderColor {
  return SENDER_COLORS[preferredColorIndex(senderId)]!;
}

/**
 * Gives each new sender a color no one else in the chat has yet: their
 * preferred (hashed) color when free, otherwise the next free one. Once the
 * palette is exhausted, senders fall back to their hashed color.
 * Existing assignments never change, so colors stay put as history loads.
 * New ids are sorted so a batch's result doesn't depend on message order.
 */
export function assignSenderColors(
  existing: SenderColors,
  senderIds: Iterable<string>,
): SenderColors {
  const newIds = [...new Set(senderIds)].filter((id) => !Object.hasOwn(existing, id)).sort();
  if (newIds.length === 0) return existing;

  const assigned: Record<string, SenderColor> = { ...existing };
  const used = new Set(Object.values(existing));
  for (const id of newIds) {
    const preferred = preferredColorIndex(id);
    let color = getSenderColor(id);
    for (let offset = 0; offset < SENDER_COLORS.length; offset++) {
      const candidate = SENDER_COLORS[(preferred + offset) % SENDER_COLORS.length]!;
      if (!used.has(candidate)) {
        color = candidate;
        break;
      }
    }
    assigned[id] = color;
    used.add(color);
  }
  return assigned;
}
