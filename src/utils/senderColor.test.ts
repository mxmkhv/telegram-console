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

describe("assignSenderColors", () => {
  it("gives senders whose hashed colors collide distinct colors", () => {
    // All three hash to the same palette color.
    const ids = ["zuck", "bezos", "gates"];
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
    const first = assignSenderColors({}, ["zuck", "elon"]);
    const next = assignSenderColors(first, ["bezos", "gates", "zuck"]);
    expect(next.zuck).toBe(first.zuck);
    expect(next.elon).toBe(first.elon);
  });

  it("does not depend on the order senders appear in", () => {
    expect(assignSenderColors({}, ["zuck", "bezos", "gates"])).toEqual(
      assignSenderColors({}, ["gates", "zuck", "bezos"]),
    );
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
