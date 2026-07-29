/** Pure helpers for Android in-app APK update progress UI. */

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
