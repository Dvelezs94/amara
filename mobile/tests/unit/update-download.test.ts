import { describe, expect, it } from "vitest";
import {
  downloadProgressRatio,
  formatDownloadBytes,
  formatDownloadPercent,
  hasEnoughDiskForDownload,
  isUpdateApkFileName,
  listUpdateApkFileNames,
  UPDATE_APK_FILE_NAME,
  UPDATE_DISK_RESERVE_BYTES,
  updateApkDestinationUri,
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

describe("update APK cache naming", () => {
  it("recognizes fixed and legacy timestamped names", () => {
    expect(isUpdateApkFileName(UPDATE_APK_FILE_NAME)).toBe(true);
    expect(isUpdateApkFileName("msa-update-1710000000000.apk")).toBe(true);
    expect(isUpdateApkFileName("photo.jpg")).toBe(false);
    expect(isUpdateApkFileName("msa-other.apk")).toBe(false);
  });

  it("lists only update APKs", () => {
    expect(
      listUpdateApkFileNames([
        "msa-update.apk",
        "msa-update-1.apk",
        "notes.txt",
        "msa-update-999.apk",
      ])
    ).toEqual(["msa-update.apk", "msa-update-1.apk", "msa-update-999.apk"]);
  });

  it("builds a stable destination uri", () => {
    expect(updateApkDestinationUri("file:///cache/")).toBe(
      `file:///cache/${UPDATE_APK_FILE_NAME}`
    );
    expect(updateApkDestinationUri("file:///cache")).toBe(
      `file:///cache/${UPDATE_APK_FILE_NAME}`
    );
  });
});

describe("hasEnoughDiskForDownload", () => {
  it("allows unknown free space", () => {
    expect(hasEnoughDiskForDownload(Number.NaN, 10_000_000)).toBe(true);
    expect(hasEnoughDiskForDownload(-1, 10_000_000)).toBe(true);
  });

  it("requires download size plus reserve", () => {
    const expected = 40 * 1024 * 1024;
    expect(
      hasEnoughDiskForDownload(expected + UPDATE_DISK_RESERVE_BYTES, expected)
    ).toBe(true);
    expect(
      hasEnoughDiskForDownload(expected + UPDATE_DISK_RESERVE_BYTES - 1, expected)
    ).toBe(false);
  });
});
