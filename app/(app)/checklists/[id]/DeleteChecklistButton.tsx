"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type DeleteChecklistButtonProps = {
  templateId: string;
  templateName: string;
};

export function DeleteChecklistButton({
  templateId,
  templateName,
}: DeleteChecklistButtonProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirmDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/checklist-templates/${templateId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "No se pudo eliminar la plantilla."
        );
        setLoading(false);
        return;
      }
      setConfirmOpen(false);
      router.push("/checklists");
      router.refresh();
    } catch {
      setError("No se pudo eliminar la plantilla.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 tap-target"
        aria-label="Eliminar checklist"
        title="Eliminar checklist"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ConfirmDialog
        open={confirmOpen}
        title="Eliminar checklist"
        message={`¿Eliminar la plantilla «${templateName}»? Se eliminarán también sus revisiones. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => {
          if (!loading) setConfirmOpen(false);
        }}
        loading={loading}
      />
    </div>
  );
}
