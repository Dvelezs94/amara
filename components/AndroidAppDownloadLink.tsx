import { headers } from "next/headers";
import Link from "next/link";

const baseClassName =
  "block w-full rounded-xl border border-zinc-300 py-3 px-4 text-center text-sm font-medium text-zinc-700 tap-target hover:bg-zinc-50";

function isAndroidBrowserUserAgent(ua: string | null): boolean {
  if (ua == null || ua === "") return false;
  return /Android/i.test(ua);
}

/** APK at deploy time (e.g. `public/downloads/android/msa-release.apk`). Only rendered for Android browsers. */
export async function AndroidAppDownloadLink({ className = "" }: { className?: string }) {
  const ua = headers().get("user-agent");
  if (!isAndroidBrowserUserAgent(ua)) return null;

  return (
    <Link
      href="/downloads/android/msa-release.apk"
      className={[baseClassName, className].filter(Boolean).join(" ")}
    >
      Descargar app (Android)
    </Link>
  );
}
