#!/usr/bin/env node

/**
 * Interactive admin user creation. Requires DATABASE_URL (PostgreSQL).
 * Usage: node scripts/create-user.js
 */

const crypto = require("crypto");
const readline = require("readline/promises");
const { stdin, stdout } = require("process");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

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
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const client = new Client({ connectionString });

  try {
    await client.connect();

    const name = (await rl.question("Name: ")).trim();
    if (!name) {
      console.error("Name is required.");
      process.exitCode = 1;
      return;
    }

    const emailRaw = (await rl.question("Email (optional): ")).trim().toLowerCase();
    const email = emailRaw || null;

    if (email) {
      const { rows } = await client.query(
        "SELECT id FROM users WHERE email = $1 LIMIT 1",
        [email]
      );
      if (rows.length) {
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
      const { rows } = await client.query(
        "SELECT id FROM users WHERE username = $1 LIMIT 1",
        [candidate]
      );
      if (!rows.length) {
        username = candidate;
        break;
      }
    }

    if (!username) {
      username = `admin.${Date.now()}`;
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    await client.query(
      `INSERT INTO users (id, username, email, name, password_hash, role, created_at)
       VALUES ($1, $2, $3, $4, $5, 'admin', NOW())`,
      [id, username, email, name, passwordHash]
    );

    console.log("");
    console.log("Admin user created successfully.");
    console.log(`Username: ${username}`);
    console.log("Role: admin");
    console.log(`ID: ${id}`);
  } finally {
    rl.close();
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error("Failed to create user:", error?.message ?? error);
  process.exit(1);
});
