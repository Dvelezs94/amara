import { describe, expect, it } from "vitest";
import {
  buildAndroidAppVersion,
  dayStampInTimeZone,
  daysSinceVersionEpoch,
  shortCommitSha,
  VERSION_CODE_EPOCH_UTC,
} from "../../lib/build-version";

describe("shortCommitSha", () => {
  it("takes first 7 hex chars", () => {
    expect(shortCommitSha("a1b2c3d4e5f6789")).toBe("a1b2c3d");
  });
  it("pads short input", () => {
    expect(shortCommitSha("abc")).toBe("abc0000");
  });
});

describe("dayStampInTimeZone", () => {
  it("formats Monterrey calendar day", () => {
    // 2026-07-29 05:00 UTC = still 2026-07-28 evening in Monterrey (UTC-6)
    const d = new Date("2026-07-29T05:00:00.000Z");
    expect(dayStampInTimeZone(d, "America/Monterrey")).toBe("20260728");
  });
});

describe("daysSinceVersionEpoch", () => {
  it("is 0 on epoch day", () => {
    expect(daysSinceVersionEpoch(new Date(VERSION_CODE_EPOCH_UTC))).toBe(0);
  });
  it("counts forward", () => {
    expect(daysSinceVersionEpoch(new Date(VERSION_CODE_EPOCH_UTC + 3 * 86400000))).toBe(3);
  });
});

describe("buildAndroidAppVersion", () => {
  const now = new Date("2026-07-28T18:00:00.000Z");

  it("builds versionName from day + sha", () => {
    const v = buildAndroidAppVersion({
      now,
      commitSha: "deadbeef1234567",
      runNumber: 42,
      timeZone: "UTC",
    });
    expect(v.versionName).toBe("20260728.deadbee");
    expect(v.shortSha).toBe("deadbee");
    expect(v.dayStamp).toBe("20260728");
  });

  it("uses runNumber in versionCode suffix", () => {
    const a = buildAndroidAppVersion({
      now,
      commitSha: "aaaaaaaa",
      runNumber: 10,
      timeZone: "UTC",
    });
    const b = buildAndroidAppVersion({
      now,
      commitSha: "bbbbbbbb",
      runNumber: 11,
      timeZone: "UTC",
    });
    expect(b.versionCode).toBe(a.versionCode + 1);
  });

  it("increases across days", () => {
    const day1 = buildAndroidAppVersion({
      now: new Date("2026-07-28T12:00:00.000Z"),
      commitSha: "aaaaaaaa",
      runNumber: 1,
      timeZone: "UTC",
    });
    const day2 = buildAndroidAppVersion({
      now: new Date("2026-07-29T12:00:00.000Z"),
      commitSha: "aaaaaaaa",
      runNumber: 1,
      timeZone: "UTC",
    });
    expect(day2.versionCode).toBeGreaterThan(day1.versionCode);
  });
});
