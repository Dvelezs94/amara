/** Android APK in-app update version helpers. */

export type AndroidAppUpdateManifest = {
  versionName: string;
  versionCode?: number;
  required?: boolean;
  apkUrl: string;
  notes?: string;
  sha256?: string;
};

export function resolveRemoteUrl(urlOrPath: string, apiHost: string): string {
  const value = urlOrPath.trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const host = apiHost.trim().replace(/\/$/, "");
  if (!host) return "";
  return `${host}${value.startsWith("/") ? "" : "/"}${value}`;
}

export function normalizeVersionCode(raw: unknown): number | null {
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 0) return null;
  return num;
}

export function parseVersionNameParts(raw: string): number[] {
  return raw
    .trim()
    .split(".")
    .map((part) => Number.parseInt(part.replace(/[^\d].*$/, ""), 10))
    .map((part) => (Number.isFinite(part) && part >= 0 ? part : 0));
}

export function compareVersionNames(a: string, b: string): number {
  const aa = parseVersionNameParts(a);
  const bb = parseVersionNameParts(b);
  const length = Math.max(aa.length, bb.length);
  for (let idx = 0; idx < length; idx += 1) {
    const left = aa[idx] ?? 0;
    const right = bb[idx] ?? 0;
    if (left !== right) return left > right ? 1 : -1;
  }
  return 0;
}

export function isRemoteVersionNewer(
  localVersionName: string,
  localVersionCode: number | null,
  remote: AndroidAppUpdateManifest
): boolean {
  const remoteCode = normalizeVersionCode(remote.versionCode);
  if (localVersionCode != null && remoteCode != null && remoteCode !== localVersionCode) {
    return remoteCode > localVersionCode;
  }
  return compareVersionNames(remote.versionName, localVersionName) > 0;
}
