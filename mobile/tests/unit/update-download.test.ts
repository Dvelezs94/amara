import { describe, expect, it } from "vitest";
import {
  downloadProgressRatio,
  formatDownloadBytes,
  formatDownloadPercent,
} from "../../lib/update-download";

describe("downloadProgressRatio", () => {
  it("returns 0 when total unknown", () => {
    expect(downloadProgressRatio(100, 0)).toBe(0);
    expect(downloadProgressRatio(100, -1)).toBe(0);
  });
  it("clamps 0..1", () => {
    expect(downloadProgressRatio(50, 100)).toBe(0.5);
    expect(downloadProgressRatio(150, 100)).toBe(1);
    expect(downloadProgressRatio(-10, 100)).toBe(0);
  });
});

describe("formatDownloadPercent", () => {
  it("formats percent", () => {
    expect(formatDownloadPercent(0.256)).toBe("26%");
    expect(formatDownloadPercent(1)).toBe("100%");
  });
});

describe("formatDownloadBytes", () => {
  it("formats sizes", () => {
    expect(formatDownloadBytes(500)).toBe("500 B");
    expect(formatDownloadBytes(2048)).toBe("2.0 KB");
    expect(formatDownloadBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
