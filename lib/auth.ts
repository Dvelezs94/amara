import { createHmac } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { createId } from "@/lib/id";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const AVAILABLE_USER_ROLES = ["technician", "supervisor", "admin"] as const;
export type UserRole = (typeof AVAILABLE_USER_ROLES)[number];

export type SessionUser = {
  id: string;
  username: string;
  email: string | null;
  name: string;
  role: UserRole;
};

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64").toString()
    );
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      columns: { id: true, username: true, email: true, name: true, role: true },
    });
    return user ?? null;
  } catch {
    return null;
  }
}

function signPayload(payload: Record<string, unknown>): string {
  const secret = process.env.SESSION_SECRET ?? "dev-secret-min-32-characters";
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })
  ).toString("base64url");
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export async function createSession(userId: string): Promise<void> {
  const token = signPayload({ sub: userId });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function verifyPassword(
  username: string,
  password: string
): Promise<SessionUser | null> {
  const user = await db.query.users.findFirst({
    // Backward compatibility: allow old email-based logins.
    where: or(eq(users.username, username), eq(users.email, username)),
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function createUser(params: {
  username: string;
  email?: string | null;
  name: string;
  password: string;
  role?: UserRole;
}): Promise<SessionUser> {
  const id = createId();
  const passwordHash = await bcrypt.hash(params.password, 10);
  await db.insert(users).values({
    id,
    username: params.username,
    email: params.email ?? null,
    name: params.name,
    passwordHash,
    role: params.role ?? "technician",
  });
  return {
    id,
    username: params.username,
    email: params.email ?? null,
    name: params.name,
    role: params.role ?? "technician",
  };
}
