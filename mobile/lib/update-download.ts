/** Pure helpers for Android in-app APK update progress UI and cache hygiene. */

/** Single reusable download target (avoids timestamped APK pile-up). */
export const UPDATE_APK_FILE_NAME = "msa-update.apk";

/** Legacy `msa-update-<timestamp>.apk` plus the current fixed name. */
const UPDATE_APK_NAME_RE = /^msa-update(-\d+)?\.apk$/i;

/** Keep free space after a download so the device is not packed full. */
export const UPDATE_DISK_RESERVE_BYTES = 50 * 1024 * 1024;

/** Conservative size hint when Content-Length is unknown (typical release APK). */
export const UPDATE_APK_SIZE_HINT_BYTES = 80 * 1024 * 1024;

export function downloadProgressRatio(
  totalBytesWritten: number,
  totalBytesExpectedToWrite: number
): number {
  if (!Number.isFinite(totalBytesWritten) || totalBytesWritten < 0) return 0;
  if (!Number.isFinite(totalBytesExpectedToWrite) || totalBytesExpectedToWrite <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, totalBytesWritten / totalBytesExpectedToWrite));
}

export function formatDownloadPercent(ratio: number): string {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return `${pct}%`;
}

export function formatDownloadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isUpdateApkFileName(name: string): boolean {
  return UPDATE_APK_NAME_RE.test(name.trim());
}

export function listUpdateApkFileNames(names: string[]): string[] {
  return names.filter(isUpdateApkFileName);
}

export function updateApkDestinationUri(baseDir: string): string {
  const base = baseDir.endsWith("/") ? baseDir : `${baseDir}/`;
  return `${base}${UPDATE_APK_FILE_NAME}`;
}

/**
 * Whether free space can hold the download plus a reserve buffer.
 * Unknown / invalid free space returns true (do not block the update).
 */
export function hasEnoughDiskForDownload(
  freeBytes: number,
  expectedDownloadBytes: number,
  reserveBytes: number = UPDATE_DISK_RESERVE_BYTES
): boolean {
  if (!Number.isFinite(freeBytes) || freeBytes < 0) return true;
  const need =
    Math.max(0, Number.isFinite(expectedDownloadBytes) ? expectedDownloadBytes : 0) +
    Math.max(0, reserveBytes);
  return freeBytes >= need;
}
