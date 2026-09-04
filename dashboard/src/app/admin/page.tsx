import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/guard";
import { AdminPanel } from "@/components/admin/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "master") redirect("/");

  return <AdminPanel user={session.user} />;
}
