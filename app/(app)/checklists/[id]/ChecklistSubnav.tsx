"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function ChecklistSubnav({
  checklistId,
  templateName,
}: {
  checklistId: string;
  templateName: string;
}) {
  const pathname = usePathname();
  const base = `/checklists/${checklistId}`;
  const onRevisions = pathname.startsWith(`${base}/revisions`);

  return (
    <div className="space-y-3">
      <nav
        className="flex flex-wrap items-center gap-1 text-sm text-zinc-500"
        aria-label="Migas de pan"
      >
        <Link
          href="/checklists"
          className="inline-flex items-center gap-1 font-medium text-[#F14C03] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Checklist
        </Link>
        <span className="text-zinc-400" aria-hidden>
          /
        </span>
        <span className="text-zinc-600">{templateName}</span>
      </nav>
      <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
        <Link
          href={base}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            !onRevisions
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          Plantilla publicada
        </Link>
        <Link
          href={`${base}/revisions`}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            onRevisions
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          Revisiones
        </Link>
      </div>
    </div>
  );
}
