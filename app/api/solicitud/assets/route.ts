import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Public list of machines for the /orden form (id, name, asset code only). */
export async function GET() {
  const list = await db
    .select({
      id: assets.id,
      name: assets.name,
      assetId: assets.assetId,
    })
    .from(assets)
    .orderBy(asc(assets.name));
  return NextResponse.json(list);
}
