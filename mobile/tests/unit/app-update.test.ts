import { describe, expect, it } from "vitest";
import {
  compareVersionNames,
  isRemoteVersionNewer,
  normalizeVersionCode,
  resolveRemoteUrl,
} from "../../lib/app-update";

describe("normalizeVersionCode", () => {
  it("accepts non-negative integers", () => {
    expect(normalizeVersionCode(3)).toBe(3);
    expect(normalizeVersionCode("12")).toBe(12);
  });
  it("rejects invalid", () => {
    expect(normalizeVersionCode(-1)).toBeNull();
    expect(normalizeVersionCode(1.5)).toBeNull();
    expect(normalizeVersionCode("x")).toBeNull();
  });
});

describe("compareVersionNames", () => {
  it("compares dotted versions", () => {
    expect(compareVersionNames("1.2.0", "1.1.9")).toBe(1);
    expect(compareVersionNames("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersionNames("1.0", "1.0.1")).toBe(-1);
  });
  it("strips non-digit suffixes in parts", () => {
    expect(compareVersionNames("1.2.3-beta", "1.2.2")).toBe(1);
  });
});

describe("isRemoteVersionNewer", () => {
  it("prefers versionCode when both present and differ", () => {
    expect(
      isRemoteVersionNewer("2.0.0", 1, {
        versionName: "1.0.0",
        versionCode: 2,
        apkUrl: "/a.apk",
      })
    ).toBe(true);
  });
  it("falls back to versionName", () => {
    expect(
      isRemoteVersionNewer("1.0.0", null, {
        versionName: "1.1.0",
        apkUrl: "/a.apk",
      })
    ).toBe(true);
    expect(
      isRemoteVersionNewer("1.1.0", null, {
        versionName: "1.0.0",
        apkUrl: "/a.apk",
      })
    ).toBe(false);
  });
});

describe("resolveRemoteUrl", () => {
  it("keeps absolute urls", () => {
    expect(resolveRemoteUrl("https://x/a", "https://host")).toBe("https://x/a");
  });
  it("joins host and path", () => {
    expect(resolveRemoteUrl("/downloads/a.apk", "https://host")).toBe(
      "https://host/downloads/a.apk"
    );
  });
  it("returns empty without host for relative", () => {
    expect(resolveRemoteUrl("/a", "")).toBe("");
  });
});
