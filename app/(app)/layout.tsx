import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { getWorkOrderStatusColors } from "@/lib/work-order-status-colors-db";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const workOrderStatusColors = await getWorkOrderStatusColors();
  return (
    <AppShell user={session} workOrderStatusColors={workOrderStatusColors}>
      {children}
    </AppShell>
  );
}
