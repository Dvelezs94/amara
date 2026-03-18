import { createHmac } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@/lib/id";

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
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
      columns: { id: true, email: true, name: true, role: true },
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
  email: string,
  password: string
): Promise<SessionUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function createUser(params: {
  email: string;
  name: string;
  password: string;
  role?: "technician" | "supervisor" | "admin";
}): Promise<SessionUser> {
  const id = createId();
  const passwordHash = await bcrypt.hash(params.password, 10);
  await db.insert(users).values({
    id,
    email: params.email,
    name: params.name,
    passwordHash,
    role: params.role ?? "technician",
  });
  return {
    id,
    email: params.email,
    name: params.name,
    role: params.role ?? "technician",
  };
}
