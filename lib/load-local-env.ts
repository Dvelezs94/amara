import { readFileSync } from "node:fs";

/**
 * Apply KEY=VALUE lines from a .env body. Existing env keys are left unchanged
 * (same as Node `--env-file` / dotenv). Used by CLI scripts that do not load
 * `.env` the way Next.js and drizzle-kit do.
 */
export function applyEnvFileContents(
  contents: string,
  env: Record<string, string | undefined> = process.env
): void {
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (env[key] !== undefined) continue;
    env[key] = value;
  }
}

export function loadLocalEnvFile(filePath = ".env"): void {
  try {
    applyEnvFileContents(readFileSync(filePath, "utf8"));
  } catch {
    // Missing or unreadable `.env` is fine; callers still validate required vars.
  }
}
