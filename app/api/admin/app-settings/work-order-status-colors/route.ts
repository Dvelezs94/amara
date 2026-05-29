import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  DEFAULT_WORK_ORDER_STATUS_COLORS,
  normalizeStatusHexColor,
  WORK_ORDER_STATUS_KEYS,
  type WorkOrderStatusColors,
} from "@/lib/work-order-status-colors";
import {
  getWorkOrderStatusColors,
  saveWorkOrderStatusColors,
} from "@/lib/work-order-status-colors-db";

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const raw = body?.colors ?? body;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "Colores inválidos" }, { status: 400 });
  }

  const next: WorkOrderStatusColors = { ...DEFAULT_WORK_ORDER_STATUS_COLORS };
  for (const key of WORK_ORDER_STATUS_KEYS) {
    const hex = normalizeStatusHexColor((raw as Record<string, unknown>)[key]);
    if (!hex) {
      return NextResponse.json(
        { error: `Color inválido para ${key} (use #RRGGBB)` },
        { status: 400 }
      );
    }
    next[key] = hex;
  }

  await saveWorkOrderStatusColors(next);
  const colors = await getWorkOrderStatusColors();
  return NextResponse.json({ colors });
}
