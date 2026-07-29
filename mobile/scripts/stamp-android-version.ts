#!/usr/bin/env node
/**
 * Stamp mobile/app.json version + android.versionCode from day + commit.
 * Used by CI before `expo prebuild`.
 *
 * Run: node --experimental-strip-types scripts/stamp-android-version.ts
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildAndroidAppVersion } from "../lib/build-version.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function gitSha(): string {
  if (process.env.GITHUB_SHA?.trim()) return process.env.GITHUB_SHA.trim();
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "0000000";
  }
}

const root = path.join(__dirname, "..");
const appJsonPath = path.join(root, "app.json");
const appConfig = JSON.parse(fs.readFileSync(appJsonPath, "utf8")) as {
  expo?: {
    version?: string;
    android?: { versionCode?: number; [k: string]: unknown };
    [k: string]: unknown;
  };
};
const baseVersion = String(appConfig?.expo?.version ?? "1.0.0").split("+")[0] ?? "1.0.0";
const runNumber = Number(process.env.GITHUB_RUN_NUMBER || "0");

const stamped = buildAndroidAppVersion({
  now: new Date(),
  commitSha: gitSha(),
  runNumber: Number.isFinite(runNumber) ? runNumber : 0,
  baseVersion,
  timeZone: "America/Monterrey",
});

appConfig.expo = appConfig.expo ?? {};
appConfig.expo.version = stamped.versionName;
appConfig.expo.android = appConfig.expo.android ?? {};
appConfig.expo.android.versionCode = stamped.versionCode;

fs.writeFileSync(appJsonPath, `${JSON.stringify(appConfig, null, 2)}\n`, "utf8");

const outPath = path.join(root, ".build-version.json");
fs.writeFileSync(outPath, `${JSON.stringify(stamped, null, 2)}\n`, "utf8");

console.log(
  `Stamped Android versionName=${stamped.versionName} versionCode=${stamped.versionCode}`
);
