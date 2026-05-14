const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Allow importing shared TS from repo `lib/` (e.g. `../lib/checklist-notification-parse` from App.tsx).
config.watchFolders = [...(config.watchFolders ?? []), monorepoRoot];

module.exports = config;
