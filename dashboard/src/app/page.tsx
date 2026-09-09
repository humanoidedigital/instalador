import { redirect } from "next/navigation";
import { clientOptions } from "@/lib/clients";
import { getSession } from "@/lib/auth/guard";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");

  // A sessão de cliente enxerga um relatório só: nem "Todos os clientes" nem o
  // nome dos outros chegam ao navegador.
  const todos = clientOptions();
  const clients =
    session.role === "cliente" ? todos.filter((client) => client.id === session.clientId) : todos;

  if (!clients.length) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-xl font-semibold">Cliente indisponível</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          A conta está ligada a um cliente que não existe mais ou foi desativado. Fale com a agência.
        </p>
      </main>
    );
  }

  if (session.role !== "cliente" && clients.length <= 1) {
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
