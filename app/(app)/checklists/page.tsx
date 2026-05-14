import { getSession } from "@/lib/auth";
import { ChecklistList } from "./ChecklistList";

export default async function ChecklistsPage() {
  const session = await getSession();
  const canCreate = session?.role !== "calidad";

  return <ChecklistList canCreate={canCreate} />;
}
