import Link from "next/link";

export default function RequestsPage() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
      Las solicitudes nuevas solo se pueden crear desde{" "}
      <Link href="/solicitud" className="font-medium text-primary-600">
        /solicitud
      </Link>
      .
    </div>
  );
}
