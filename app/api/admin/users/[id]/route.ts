import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  AVAILABLE_USER_ROLES,
  getSession,
  type UserRole,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { recordAuditLog } from "@/lib/audit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: targetId } = await params;
  const target = await db.query.users.findFirst({
    where: eq(users.id, targetId),
  });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Partial<{
    name: string;
    email: string | null;
    role: UserRole;
    passwordHash: string;
  }> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ error: "Nombre invalido" }, { status: 400 });
    }
    updates.name = name;
  }
  if (body.email !== undefined) {
    const emailRaw = String(body.email).trim().toLowerCase();
    const email = emailRaw || null;
    if (email) {
      const taken = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
      if (taken && taken.id !== targetId) {
        return NextResponse.json(
          { error: "Email ya esta en uso" },
          { status: 409 }
        );
      }
    }
    updates.email = email;
  }
  if (body.role !== undefined) {
    const role = String(body.role) as UserRole;
    if (!AVAILABLE_USER_ROLES.includes(role)) {
      return NextResponse.json({ error: "Rol invalido" }, { status: 400 });
    }
    updates.role = role;
  }
  if (body.password !== undefined) {
    const password = String(body.password ?? "");
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Contrasena debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }
    updates.passwordHash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, targetId));

  await recordAuditLog({
    entityType: "user",
    entityId: targetId,
    action: "updated",
    userId: session.id,
    metadata: {
      targetUsername: target.username,
      before: {
        name: target.name,
        email: target.email,
        role: target.role,
      },
      after: updates,
      passwordUpdated: Boolean(body.password !== undefined),
    },
  });

  return NextResponse.json({ ok: true });
}
