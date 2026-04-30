import Link from "next/link";

export default function NewRequestPage() {
  return (
    <div className="max-w-lg mx-auto rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
      Esta pantalla fue deshabilitada. Las ordenes nuevas se crean en{" "}
      <Link href="/orden" className="font-medium text-primary-600">
        /orden
      </Link>
      .
    </div>
  );
}
