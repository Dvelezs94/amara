"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { UserAvatar } from "@/components/UserAvatar";

export function ProfilePhotoUpload({
  userId,
  name,
  initialAvatarUrl,
}: {
  userId: string;
  name: string;
  initialAvatarUrl: string | null;
}) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/users/me/avatar", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo subir la imagen");
        return;
      }
      setAvatarUrl(data.avatarUrl ?? null);
      router.refresh();
    } catch {
      setError("No se pudo subir la imagen");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <UserAvatar
        userId={userId}
        name={name}
        avatarUrl={avatarUrl}
        size="lg"
        className="ring-2 ring-white shadow"
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 tap-target disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        {uploading ? "Subiendo…" : "Cambiar foto de perfil"}
      </button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
      <p className="text-center text-xs text-zinc-500">
        Si no subes foto, se muestra tu inicial con un color fijo.
      </p>
    </div>
  );
}
