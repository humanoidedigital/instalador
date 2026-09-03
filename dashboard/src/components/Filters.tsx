"use client";

import { useEffect, useState } from "react";
import { DATE_PRESETS } from "@/lib/dates";

export interface FilterState {
  clientId: string;
  preset: string;
  from: string;
  to: string;
}

export interface ClientOption {
  id: string;
  name: string;
  hasCrm: boolean;
}

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
      className="control no-print"
    >
      <option value="system">Aparência: sistema</option>
      <option value="light">Aparência: clara</option>
      <option value="dark">Aparência: escura</option>
    </select>
  );
}

export function Filters({
  clients,
  state,
  onChange,
  onRefresh,
  onExport,
  loading,
}: {
  clients: ClientOption[];
  state: FilterState;
  onChange: (next: FilterState) => void;
  onRefresh: () => void;
  onExport: () => void;
  loading: boolean;
}) {
  const isCustom = state.preset === "custom";

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <select
        value={state.clientId}
        onChange={(event) => onChange({ ...state, clientId: event.target.value })}
        aria-label="Cliente"
        className="control min-w-[200px] font-medium"
      >
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>

      <select
        value={state.preset}
        onChange={(event) => onChange({ ...state, preset: event.target.value })}
        aria-label="Período"
        className="control"
      >
        {DATE_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
        <option value="custom">Período personalizado</option>
      </select>

      {isCustom ? (
        <>
          <input
            type="date"
            value={state.from}
            max={state.to}
            onChange={(event) => onChange({ ...state, from: event.target.value })}
            aria-label="Data inicial"
            className="control"
          />
          <input
            type="date"
            value={state.to}
            min={state.from}
            onChange={(event) => onChange({ ...state, to: event.target.value })}
            aria-label="Data final"
            className="control"
          />
        </>
      ) : null}

      <button type="button" onClick={onRefresh} className="control no-print" disabled={loading}>
        {loading ? "Atualizando…" : "Atualizar dados"}
      </button>

      <button type="button" onClick={onExport} className="control no-print">
        Exportar CSV
      </button>

      <ThemeToggle />
    </div>
  );
}
