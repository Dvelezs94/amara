import { headers } from "next/headers";
import Link from "next/link";
import { Smartphone } from "lucide-react";

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
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200 bg-white text-[#3DDC84] shadow-md tap-target transition-shadow hover:bg-zinc-50 hover:shadow-lg md:bottom-8 md:right-8"
      aria-label="Descargar app Android (APK)"
      title="Descargar app (Android)"
    >
      <Smartphone className="h-7 w-7" strokeWidth={2} aria-hidden />
    </Link>
  );
}
