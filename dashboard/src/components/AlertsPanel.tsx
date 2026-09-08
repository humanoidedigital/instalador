"use client";

import { useEffect, useState } from "react";
import type { DashboardPayload } from "@/lib/types";

interface AlertEvent {
  id: number;
  ruleName: string;
  clientId: string;
  clientName: string;
  severity: string;
  title: string;
  detail: string;
  firedOn: string;
}

const SEVERITY: Record<string, { label: string; color: string; ordem: number }> = {
  critico: { label: "Crítico", color: "var(--critical)", ordem: 0 },
  atencao: { label: "Atenção", color: "var(--warning)", ordem: 1 },
  informativo: { label: "Informativo", color: "var(--series-1)", ordem: 2 },
};

function severity(id: string) {
  return SEVERITY[id] || { label: id, color: "var(--text-muted)", ordem: 3 };
}

function daysBetween(from: string, to: string): number {
  const diff = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Number.isFinite(diff) ? Math.max(1, Math.round(diff / 86_400_000) + 1) : 14;
}

/**
 * Alertas já registrados para o cliente, do banco.
 *
 * Não recalcula nada: mostra o que a coleta diária (ou o "Rodar agora" da
 * administração) gravou, para o relatório não depender de uma avaliação cara
 * a cada carregamento.
 */
export function AlertsPanel({ data }: { data: DashboardPayload }) {
  const [alertas, setAlertas] = useState<AlertEvent[] | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");

  const { clientId, range } = data.meta;
  const days = daysBetween(range.from, range.to);

  useEffect(() => {
    let cancelado = false;
    const params = new URLSearchParams({ client: clientId, days: String(days) });

    fetch(`/api/alerts?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as {
          alertas?: AlertEvent[];
          motivo?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(body.error || "Falha ao carregar os alertas.");
        if (cancelado) return;
        setAlertas(body.alertas || []);
        setMotivo(body.motivo || "");
      })
      .catch((error: Error) => {
        if (!cancelado) setErro(error.message);
      });

    return () => {
      cancelado = true;
    };
  }, [clientId, days]);

  if (erro) {
    return (
      <div className="card p-4">
        <p className="text-xs" style={{ color: "var(--critical)" }}>
          {erro}
        </p>
      </div>
    );
  }

  if (alertas === null) {
    return (
      <div className="card p-4">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Carregando alertas…
        </p>
      </div>
    );
  }

  if (!alertas.length) {
    return (
      <div className="card p-4">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {motivo || "Nenhum alerta no período. As regras rodaram e nada passou dos limiares."}
        </p>
      </div>
    );
  }

  const ordenados = [...alertas].sort((a, b) => {
    const peso = severity(a.severity).ordem - severity(b.severity).ordem;
    return peso !== 0 ? peso : b.firedOn.localeCompare(a.firedOn);
  });

  const criticos = ordenados.filter((alerta) => alerta.severity === "critico").length;

  return (
    <div className="card p-4">
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {ordenados.length} alerta(s) nos últimos {days} dias
        {criticos ? ` — ${criticos} crítico(s)` : ""}.
      </p>

      <ul className="mt-3 space-y-2">
        {ordenados.map((alerta) => {
          const tom = severity(alerta.severity);
          return (
            <li
              key={alerta.id}
              className="rounded-lg p-3"
              style={{
                background: `color-mix(in srgb, ${tom.color} 8%, transparent)`,
                borderLeft: `3px solid ${tom.color}`,
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {alerta.title}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {tom.label} · {alerta.firedOn}
                  {data.meta.clientId === "__all__" ? ` · ${alerta.clientName}` : ""}
                </span>
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {alerta.detail}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
