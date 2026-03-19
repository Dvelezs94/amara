import { NextResponse } from "next/server";
import { createUser, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = (body.username ?? "").trim().toLowerCase();
  const emailRaw = (body.email ?? "").trim().toLowerCase();
  const email = emailRaw || null;
  const name = (body.name ?? "").trim();
  const password = body.password ?? "";
  if (!username || !name || !password) {
    return NextResponse.json(
      { error: "Name, username and password required" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  const existingByUsername = await db.query.users.findFirst({
    where: eq(users.username, username),
  });
  if (existingByUsername) {
    return NextResponse.json(
      { error: "This username is already in use" },
      { status: 409 }
    );
  }
  if (email) {
    const existingByEmail = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existingByEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }
  }
  const user = await createUser({ username, email, name, password });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
