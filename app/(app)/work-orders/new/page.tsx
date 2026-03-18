import { WorkOrderForm } from "../WorkOrderForm";

export default function NewWorkOrderPage() {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Nueva orden de trabajo</h1>
      <WorkOrderForm />
    </div>
  );
}
