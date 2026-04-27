import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { assetFiles } from "@/lib/db/schema";
import { assets } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");

  const files = await db.query.assetFiles.findMany({
    where: assetId ? eq(assetFiles.assetId, assetId) : undefined,
    orderBy: [desc(assetFiles.createdAt)],
  });
  if (files.length === 0) {
    return NextResponse.json([]);
  }
  const assetIds = Array.from(
    new Set(files.map((f) => f.assetId).filter(Boolean) as string[])
  );
  const assetMap = new Map<string, { id: string; name: string; assetId: string }>();
  if (assetIds.length > 0) {
    const assetList = await db
      .select({ id: assets.id, name: assets.name, assetId: assets.assetId })
      .from(assets)
      .where(inArray(assets.id, assetIds));
    assetList.forEach((a) => assetMap.set(a.id, a));
  }
  const result = files.map((f) => ({
    ...f,
    fileUrl: `/api/asset-files/${f.id}`,
    asset: f.assetId ? assetMap.get(f.assetId) ?? null : null,
  }));
  return NextResponse.json(result);
}
