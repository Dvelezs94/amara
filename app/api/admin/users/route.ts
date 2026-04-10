import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { AVAILABLE_USER_ROLES, createUser, getSession, type UserRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const list = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      avatarUrl: users.avatarUrl,
      avatarBackgroundColor: users.avatarBackgroundColor,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const username = (body.username ?? "").trim().toLowerCase();
  const emailRaw = (body.email ?? "").trim().toLowerCase();
  const email = emailRaw || null;
  const name = (body.name ?? "").trim();
  const password = String(body.password ?? "");
  const role = String(body.role ?? "") as UserRole;

  if (!username || !name || !password || !role) {
    return NextResponse.json(
      { error: "Name, username, password and role are required" },
      { status: 400 }
    );
  }
  if (!AVAILABLE_USER_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
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

  const user = await createUser({ username, email, name, password, role });
  await recordAuditLog({
    entityType: "user",
    entityId: user.id,
    action: "created_by_admin",
    userId: session.id,
    metadata: { username, email, role, name },
  });

  return NextResponse.json({ ok: true, id: user.id });
}
