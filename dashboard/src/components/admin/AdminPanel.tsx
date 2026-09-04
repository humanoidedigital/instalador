"use client";

import { useEffect, useState } from "react";
import { ClientsTab } from "./ClientsTab";
import { ConnectionsTab } from "./ConnectionsTab";
import { AccessTab } from "./AccessTab";
import { SystemTab } from "./SystemTab";

const TABS = [
  { id: "clientes", label: "Clientes" },
  { id: "conexoes", label: "Conexões" },
  { id: "acesso", label: "Acesso" },
  { id: "sistema", label: "Sistema" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function ThemeToggle() {
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");

  useEffect(() => {
    const stored = localStorage.getItem("dashboard-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function apply(next: "system" | "light" | "dark") {
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem("dashboard-theme");
      document.documentElement.removeAttribute("data-theme");
      return;
    }
    localStorage.setItem("dashboard-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <select
      value={theme}
      onChange={(event) => apply(event.target.value as "system" | "light" | "dark")}
      aria-label="Aparência"
      className="control"
    >
      <option value="system">Tema: auto</option>
      <option value="light">Tema: claro</option>
      <option value="dark">Tema: escuro</option>
    </select>
  );
}

export function AdminPanel({ user }: { user: string }) {
  const [tab, setTab] = useState<TabId>("clientes");

  // A aba aberta fica na URL, para poder voltar direto no mesmo lugar.
  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as TabId;
    if (TABS.some((item) => item.id === hash)) setTab(hash);
  }, []);

  function open(next: TabId) {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Administração
          </h1>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Conectado como <strong>{user}</strong> (conta master).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/" className="control">
            Ver relatório
          </a>
          <ThemeToggle />
          <button type="button" onClick={logout} className="control">
            Sair
          </button>
        </div>
      </header>

      <nav
        className="mb-6 flex flex-wrap gap-1"
        style={{ borderBottom: "1px solid var(--border)" }}
        aria-label="Seções da administração"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => open(item.id)}
              aria-current={active ? "page" : undefined}
              className="px-3 py-2 text-sm"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: active ? 600 : 400,
                borderBottom: `2px solid ${active ? "var(--series-1)" : "transparent"}`,
                marginBottom: "-1px",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {tab === "clientes" ? <ClientsTab /> : null}
      {tab === "conexoes" ? <ConnectionsTab /> : null}
      {tab === "acesso" ? <AccessTab user={user} /> : null}
      {tab === "sistema" ? <SystemTab /> : null}
    </main>
  );
}
