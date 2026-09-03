import { clientOptions } from "@/lib/clients";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default function Page() {
  const clients = clientOptions();

  if (clients.length <= 1) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-xl font-semibold">Nenhum cliente configurado</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Edite <code>config/clients.json</code> na raiz do dashboard e cadastre pelo menos um cliente com as contas de
          Meta Ads, Google Ads e o <code>ghlLocationId</code> do GoHighLevel.
        </p>
      </main>
    );
  }

  return <Dashboard clients={clients} />;
}
