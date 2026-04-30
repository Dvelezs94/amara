import Link from "next/link";

const baseClassName =
  "block w-full rounded-xl border border-zinc-300 py-3 px-4 text-center text-sm font-medium text-zinc-700 tap-target hover:bg-zinc-50";

/** APK served at deploy time (e.g. `public/downloads/android/msa-release.apk`). */
export function AndroidAppDownloadLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/downloads/android/msa-release.apk"
      className={[baseClassName, className].filter(Boolean).join(" ")}
    >
      Descargar app (Android)
    </Link>
  );
}
