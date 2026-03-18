import { RequestForm } from "../RequestForm";

export default function NewRequestPage() {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Nueva solicitud</h1>
      <RequestForm />
    </div>
  );
}
