import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requests } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { assets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { RequestDetail } from "./RequestDetail";

async function getRequest(id: string) {
  const r = await db.query.requests.findFirst({
    where: eq(requests.id, id),
  });
  if (!r) return null;
  const [requester, asset] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, r.requesterId),
      columns: { id: true, name: true, email: true },
    }),
    r.assetId
      ? db.query.assets.findFirst({
          where: eq(assets.id, r.assetId),
          columns: { id: true, name: true, assetId: true },
        })
      : null,
  ]);
  return { ...r, requester: requester ?? null, asset: asset ?? null };
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const r = await getRequest(id);
  if (!r) notFound();
  return (
    <div className="space-y-4">
      <RequestDetail request={r} />
      <Link
        href="/requests"
        className="inline-block text-sm text-primary-600 font-medium"
      >
        Volver a solicitudes
      </Link>
    </div>
  );
}
