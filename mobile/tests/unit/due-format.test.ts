import { describe, expect, it } from "vitest";
import {
  calendarDaysFromToday,
  formatDueRelative,
  formatDurationUntilDueShort,
} from "../../lib/due-format";

const NOW = new Date(2026, 6, 15, 12, 0, 0); // 2026-07-15 local

describe("calendarDaysFromToday", () => {
  it("returns 0 for today", () => {
    expect(calendarDaysFromToday("2026-07-15T18:00:00", NOW)).toBe(0);
  });
  it("returns positive for future", () => {
    expect(calendarDaysFromToday("2026-07-17T00:00:00", NOW)).toBe(2);
  });
  it("returns null for invalid", () => {
    expect(calendarDaysFromToday("nope", NOW)).toBeNull();
  });
});

describe("formatDueRelative", () => {
  it("formats near due dates", () => {
    expect(formatDueRelative("2026-07-15T12:00:00", NOW)).toBe("Vence hoy");
    expect(formatDueRelative("2026-07-16T12:00:00", NOW)).toBe("Vence mañana");
    expect(formatDueRelative("2026-07-14T12:00:00", NOW)).toBe("Venció ayer");
  });
  it("handles empty", () => {
    expect(formatDueRelative(null, NOW)).toBe("—");
  });
});

describe("formatDurationUntilDueShort", () => {
  it("returns Vencida for past", () => {
    expect(formatDurationUntilDueShort("2026-07-14T12:00:00", NOW)).toBe("Vencida");
  });
  it("returns minutes under an hour", () => {
    expect(formatDurationUntilDueShort("2026-07-15T12:30:00", NOW)).toBe("30m");
  });
});
