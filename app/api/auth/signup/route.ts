import { NextResponse } from "next/server";
import { createUser, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const password = body.password ?? "";
  if (!email || !name || !password) {
    return NextResponse.json(
      { error: "Name, email and password required" },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }
  const user = await createUser({ email, name, password });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
