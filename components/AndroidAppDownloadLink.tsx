import { headers } from "next/headers";
import Link from "next/link";

function isAndroidBrowserUserAgent(ua: string | null): boolean {
  if (ua == null || ua === "") return false;
  return /Android/i.test(ua);
}

/** Floating APK link (fixed bottom-right), only for Android browsers. */
export async function AndroidAppDownloadLink() {
  const ua = headers().get("user-agent");
  if (!isAndroidBrowserUserAgent(ua)) return null;

  return (
    <Link
      href="/downloads/android/msa-release.apk"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-4 z-50 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-3 text-[#3DDC84] shadow-md tap-target transition-shadow hover:bg-zinc-50 hover:shadow-lg md:bottom-8 md:right-8"
      aria-label="Descargar app Android (APK)"
      title="Descargar app (Android)"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden focusable="false">
        <path
          fill="currentColor"
          d="M7.5 2.2a.75.75 0 0 1 1.06.08l1.04 1.2a7.1 7.1 0 0 1 4.8 0l1.04-1.2a.75.75 0 1 1 1.14.98l-.9 1.04A6.25 6.25 0 0 1 18.25 9v6.5A1.5 1.5 0 0 1 16.75 17h-.5v2a.75.75 0 0 1-1.5 0v-2h-5.5v2a.75.75 0 0 1-1.5 0v-2h-.5a1.5 1.5 0 0 1-1.5-1.5V9c0-2.06.99-3.88 2.52-5.03l-.9-1.04a.75.75 0 0 1 .08-1.06ZM7.25 9v6.5h9.5V9a4.75 4.75 0 0 0-9.5 0Zm2.5 2.25a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0Zm6.3 0a.9.9 0 1 1-1.8 0 .9.9 0 0 1 1.8 0Z"
        />
      </svg>
      <span className="text-sm font-semibold text-zinc-800">Descargar app</span>
    </Link>
  );
}
