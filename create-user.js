#!/usr/bin/env node

const path = require("path");
const crypto = require("crypto");
const readline = require("readline/promises");
const { stdin, stdout } = require("process");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "sqlite.db");

function normalizeNameForUsername(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function generateUsername(name, fallbackIndex) {
  const base = normalizeNameForUsername(name) || "admin";
  if (fallbackIndex === 0) return base;
  return `${base}${fallbackIndex + 1}`;
}

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const db = new Database(DB_PATH);

  try {
    const name = (await rl.question("Name: ")).trim();
    if (!name) {
      console.error("Name is required.");
      process.exitCode = 1;
      return;
    }

    const emailRaw = (await rl.question("Email (optional): ")).trim().toLowerCase();
    const email = emailRaw || null;

    if (email) {
      const existingByEmail = db
        .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
        .get(email);
      if (existingByEmail) {
        console.error("That email is already in use.");
        process.exitCode = 1;
        return;
      }
    }

    const password = await rl.question("Password: ", { hideEchoBack: true });
    if (password.length < 8) {
      console.error("Password must be at least 8 characters.");
      process.exitCode = 1;
      return;
    }

    let username = "";
    for (let i = 0; i < 200; i += 1) {
      const candidate = generateUsername(name, i);
      const existing = db
        .prepare("SELECT id FROM users WHERE username = ? LIMIT 1")
        .get(candidate);
      if (!existing) {
        username = candidate;
        break;
      }
    }

    if (!username) {
      username = `admin.${Date.now()}`;
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const nowUnix = Math.floor(Date.now() / 1000);

    db.prepare(
      `
      INSERT INTO users (id, username, email, name, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?, 'admin', ?)
      `
    ).run(id, username, email, name, passwordHash, nowUnix);

    console.log("");
    console.log("Admin user created successfully.");
    console.log(`Username: ${username}`);
    console.log(`Role: admin`);
    console.log(`ID: ${id}`);
  } finally {
    rl.close();
    db.close();
  }
}

main().catch((error) => {
  console.error("Failed to create user:", error?.message ?? error);
  process.exit(1);
});
