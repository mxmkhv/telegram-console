import { describe, it, expect } from "bun:test";
import { formatChatTime, formatDayLabel, isSameDay } from "./formatDate";

// Wednesday, October 7 2026, mid-afternoon
const now = new Date(2026, 9, 7, 15, 0);
const at = (month: number, day: number, hour = 9, year = 2026) => new Date(year, month, day, hour, 5);

describe("formatDayLabel", () => {
  it("names recent days", () => {
    expect(formatDayLabel(at(9, 7, 0), now)).toBe("Today");
    expect(formatDayLabel(at(9, 6, 23), now)).toBe("Yesterday");
    expect(formatDayLabel(at(9, 5), now)).toBe("Monday");
    expect(formatDayLabel(at(9, 1), now)).toBe("Thursday");
  });

  it("dates older days, with the year only when it differs", () => {
    expect(formatDayLabel(at(8, 30), now)).toBe("Wed, Sep 30");
    expect(formatDayLabel(at(11, 31, 9, 2025), now)).toBe("Dec 31, 2025");
  });
});

describe("formatChatTime", () => {
  it("shows the time today, then shorter dates", () => {
    expect(formatChatTime(at(9, 7, 9), now)).toBe("09:05");
    expect(formatChatTime(at(9, 6), now)).toBe("Yest");
    expect(formatChatTime(at(9, 3), now)).toBe("Sat");
    expect(formatChatTime(at(8, 30), now)).toBe("Sep 30");
    expect(formatChatTime(at(11, 31, 9, 2025), now)).toBe("12/31/25");
  });

  it("treats clock skew into the future as today", () => {
    expect(formatChatTime(new Date(2026, 9, 7, 15, 1), now)).toBe("15:01");
  });
});

describe("isSameDay", () => {
  it("compares calendar days, not 24-hour spans", () => {
    expect(isSameDay(at(9, 6, 23), at(9, 7, 0))).toBe(false);
    expect(isSameDay(at(9, 7, 0), at(9, 7, 23))).toBe(true);
  });
});
