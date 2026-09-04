import { redirect } from "next/navigation";
import { authConfigured, getSession, masterUser } from "@/lib/auth/guard";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  const configured = authConfigured();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <LoginForm mode={configured ? "login" : "setup"} defaultUser={configured ? masterUser() : "admin"} />
        {!configured ? (
          <p className="mt-4 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
            Ninguém consegue abrir o painel enquanto esta senha não for criada.
          </p>
        ) : null}
      </div>
    </main>
  );
}
