import { redirect } from "next/navigation";
import { clientOptions } from "@/lib/clients";
import { getSession } from "@/lib/auth/guard";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  const clients = clientOptions();

  if (clients.length <= 1) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-xl font-semibold">Nenhum cliente configurado</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Edite <code>config/clients.json</code> na raiz do dashboard e cadastre pelo menos um cliente com as contas de
          Meta Ads, Google Ads e o <code>rdCrmTokenEnv</code> do RD Station CRM.
        </p>
      </main>
    );
  }

  return <Dashboard clients={clients} role={session.role} />;
}
