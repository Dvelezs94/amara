/** Pure helpers to stamp Android app versions from day + commit (CI). */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Anchor so versionCode stays within Android's 32-bit int range. */
export const VERSION_CODE_EPOCH_UTC = Date.UTC(2024, 0, 1);

export type AndroidBuildVersionInput = {
  now: Date;
  commitSha: string;
  /** GitHub Actions run number — preferred for same-day monotonic increments. */
  runNumber?: number | null;
  /** Base semver from app.json (e.g. "1.0.0"). */
  baseVersion?: string;
  /** IANA timezone for the calendar "day" part of versionName. */
  timeZone?: string;
};

export type AndroidBuildVersion = {
  versionName: string;
  versionCode: number;
  dayStamp: string;
  shortSha: string;
};

export function shortCommitSha(commitSha: string, length = 7): string {
  const hex = commitSha.trim().toLowerCase().replace(/^[^0-9a-f]+/, "");
  const cleaned = hex.replace(/[^0-9a-f]/g, "");
  if (!cleaned) return "0000000".slice(0, length);
  return cleaned.slice(0, length).padEnd(length, "0");
}

/** YYYYMMDD in the given timezone. */
export function dayStampInTimeZone(now: Date, timeZone = "America/Monterrey"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}${m}${d}`;
}

function utcMidnight(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** Days since VERSION_CODE_EPOCH_UTC (UTC calendar). */
export function daysSinceVersionEpoch(now: Date): number {
  const day = utcMidnight(now.getTime());
  const epoch = utcMidnight(VERSION_CODE_EPOCH_UTC);
  return Math.max(0, Math.floor((day - epoch) / DAY_MS));
}

function commitDerivedSuffix(shortSha: string): number {
  const n = Number.parseInt(shortSha.slice(0, 5), 16);
  if (!Number.isFinite(n) || n < 0) return 1;
  return (n % 9999) + 1;
}

/**
 * versionCode = daysSinceEpoch * 10000 + suffix(0..9999)
 * Always increases across days; within a day, GITHUB_RUN_NUMBER keeps it monotonic.
 * versionName = `{base}+{YYYYMMDD}.{shortSha}`
 */
export function buildAndroidAppVersion(input: AndroidBuildVersionInput): AndroidBuildVersion {
  const timeZone = input.timeZone ?? "America/Monterrey";
  const base = (input.baseVersion ?? "1.0.0").trim() || "1.0.0";
  const shortSha = shortCommitSha(input.commitSha);
  const dayStamp = dayStampInTimeZone(input.now, timeZone);
  const days = daysSinceVersionEpoch(input.now);

  const run = Number(input.runNumber);
  const suffix =
    Number.isInteger(run) && run > 0 ? run % 10000 : commitDerivedSuffix(shortSha);

  const versionCode = days * 10000 + suffix;
  const versionName = `${base}+${dayStamp}.${shortSha}`;

  return { versionName, versionCode, dayStamp, shortSha };
}
