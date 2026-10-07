import { describe, it, expect } from "bun:test";
import { assignSenderColors, getSenderColor, SENDER_COLORS } from "./senderColor";

describe("getSenderColor", () => {
  it("returns the same color for the same sender id", () => {
    expect(getSenderColor("123456789")).toBe(getSenderColor("123456789"));
  });

  it("spreads sender ids across the whole palette", () => {
    const used = new Set<string>();
    for (let i = 0; i < 500; i++) used.add(getSenderColor(String(1_000_000 + i)));
    expect(used.size).toBe(SENDER_COLORS.length);
  });
});

// Ids that hash to the same palette color, found at runtime so the tests
// don't depend on specific hash outputs.
function findCollidingIds(count: number): string[] {
  const byColor = new Map<string, string[]>();
  for (let i = 0; ; i++) {
    const id = `user${i}`;
    const ids = [...(byColor.get(getSenderColor(id)) ?? []), id];
    if (ids.length === count) return ids;
    byColor.set(getSenderColor(id), ids);
  }
}

describe("assignSenderColors", () => {
  it("gives senders whose hashed colors collide distinct colors", () => {
    const ids = findCollidingIds(3);
    expect(new Set(ids.map(getSenderColor)).size).toBe(1);

    const colors = assignSenderColors({}, ids);
    expect(new Set(ids.map((id) => colors[id])).size).toBe(3);
  });

  it("uses a sender's hashed color when it is free", () => {
    expect(assignSenderColors({}, ["elon"]).elon).toBe(getSenderColor("elon"));
  });

  it("is unique for as many senders as the palette has colors", () => {
    const ids = Array.from({ length: SENDER_COLORS.length }, (_, i) => `user${i}`);
    const colors = assignSenderColors({}, ids);
    expect(new Set(Object.values(colors)).size).toBe(SENDER_COLORS.length);
  });

  it("falls back to the hashed color once the palette is exhausted", () => {
    const ids = Array.from({ length: SENDER_COLORS.length }, (_, i) => `user${i}`);
    const full = assignSenderColors({}, ids);
    expect(assignSenderColors(full, ["late"]).late).toBe(getSenderColor("late"));
  });

  it("never changes existing assignments when new senders arrive", () => {
    const [a, b, c] = findCollidingIds(3) as [string, string, string];
    const first = assignSenderColors({}, [c, "elon"]);
    const next = assignSenderColors(first, [a, b, c]);
    expect(next[c]).toBe(first[c]);
    expect(next.elon).toBe(first.elon);
  });

  it("does not depend on the order senders appear in within a batch", () => {
    const [a, b, c] = findCollidingIds(3) as [string, string, string];
    expect(assignSenderColors({}, [a, b, c])).toEqual(assignSenderColors({}, [c, a, b]));
  });

  it("returns the same object when there are no new senders", () => {
    const colors = assignSenderColors({}, ["elon"]);
    expect(assignSenderColors(colors, ["elon"])).toBe(colors);
  });
});

describe("SENDER_COLORS", () => {
  it("excludes colors reserved for you, errors and focus", () => {
    for (const reserved of ["blue", "blueBright", "red", "redBright", "cyan", "cyanBright"]) {
      expect(SENDER_COLORS).not.toContain(reserved as never);
    }
  });
});
