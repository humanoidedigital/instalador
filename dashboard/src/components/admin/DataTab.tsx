"use client";

import { useCallback, useEffect, useState } from "react";
import { Notice } from "./shared";

interface CoverageEntry {
  minDate: string | null;
  maxDate: string | null;
  rows: number;
}

interface DataInfo {
  habilitado: boolean;
  arquivo: string;
  estatisticas?: { bytes: number; adRows: number; dealRows: number };
  janelaPadraoDias?: number;
  cobertura?: { clientId: string; clientName: string; ads: CoverageEntry | null; crm: CoverageEntry | null }[];
  execucoes?: {
    id: number;
    clientId: string;
    source: string;
    rangeFrom: string;
    rangeTo: string;
    rows: number;
    status: string;
    error: string | null;
    finishedAt: string;
  }[];
}

function br(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10).split("-").reverse().join("/");
}

function mb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function Cell({ entry }: { entry: CoverageEntry | null }) {
  if (!entry || !entry.rows) {
    return (
      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        sem dados
      </span>
    );
  }
  return (
    <span className="tnum text-xs" style={{ color: "var(--text-primary)" }}>
      {br(entry.minDate)} – {br(entry.maxDate)}
      <span className="ml-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        {entry.rows.toLocaleString("pt-BR")} linhas
      </span>
    </span>
  );
}

export function DataTab() {
  const [info, setInfo] = useState<DataInfo | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "erro" | "aviso"; text: string } | null>(null);
  const [running, setRunning] = useState<number | null>(null);

  const load = useCallback(async () => {
    const body = (await fetch("/api/admin/data").then((r) => r.json())) as DataInfo;
    setInfo(body);
  }, []);

  useEffect(() => {
    load().catch(() => setStatus({ tone: "erro", text: "Não foi possível ler o estado do histórico." }));
  }, [load]);

  async function collect(days: number) {
    setRunning(days);
    setStatus({ tone: "aviso", text: `Coletando ${days} dia(s)… isso pode levar alguns minutos em contas grandes.` });
    try {
      const response = await fetch(`/api/collect?days=${days}`, { method: "POST" });
      const body = (await response.json()) as {
        ok?: boolean;
        linhas?: number;
        duracaoMs?: number;
        error?: string;
        resultados?: { clientName: string; source: string; status: string; error?: string }[];
      };
      if (!response.ok) throw new Error(body.error || "Falha na coleta.");

      const falhas = (body.resultados || []).filter((item) => item.status === "erro");
      setStatus({
        tone: falhas.length ? "aviso" : "ok",
        text: falhas.length
          ? `${body.linhas} linhas gravadas, mas ${falhas.length} coleta(s) falharam: ${falhas
              .map((item) => `${item.clientName}/${item.source} — ${item.error}`)
              .join(" · ")}`
          : `${body.linhas} linhas gravadas em ${Math.round((body.duracaoMs || 0) / 1000)}s.`,
      });
      await load();
    } catch (error) {
      setStatus({ tone: "erro", text: (error as Error).message });
    } finally {
      setRunning(null);
    }
  }

  if (!info) return <div className="card h-40 animate-pulse" />;

  if (!info.habilitado) {
    return (
      <Notice tone="aviso">
        O banco está desativado (<code>DATABASE_ENABLED=false</code>). Sem histórico, o relatório só consegue mostrar o
        que as APIs devolvem no momento.
      </Notice>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {info.estatisticas?.adRows.toLocaleString("pt-BR")} linhas de mídia ·{" "}
          {info.estatisticas?.dealRows.toLocaleString("pt-BR")} negociações · {mb(info.estatisticas?.bytes || 0)} em disco
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="control" onClick={() => collect(info.janelaPadraoDias || 7)} disabled={running !== null}>
            {running === (info.janelaPadraoDias || 7) ? "Coletando…" : `Coletar ${info.janelaPadraoDias || 7} dias`}
          </button>
          <button type="button" className="control" onClick={() => collect(90)} disabled={running !== null}>
            {running === 90 ? "Coletando…" : "Backfill 90 dias"}
          </button>
          <button type="button" className="control" onClick={() => collect(365)} disabled={running !== null}>
            {running === 365 ? "Coletando…" : "Backfill 365 dias"}
          </button>
        </div>
      </div>

      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}

      <section className="card p-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Cobertura por cliente
        </h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          Períodos já gravados. O relatório usa o histórico quando ele cobre o período pedido, e cai para as APIs quando
          não cobre.
        </p>

        <div className="scroll-x mt-3">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="sticky-head">
              <tr>
                {["Cliente", "Mídia paga", "CRM"].map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="py-2 pr-3 font-medium"
                    style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(info.cobertura || []).map((row) => (
                <tr key={row.clientId} className="data-row">
                  <td className="py-2 pr-3" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    {row.clientName}
                  </td>
                  <td className="py-2 pr-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <Cell entry={row.ads} />
                  </td>
                  <td className="py-2 pr-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <Cell entry={row.crm} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Últimas coletas
        </h3>
        <div className="scroll-x mt-3 max-h-[320px] overflow-y-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="sticky-head">
              <tr>
                {["Quando", "Cliente", "Fonte", "Período", "Linhas", "Situação"].map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="py-2 pr-3 font-medium"
                    style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(info.execucoes || []).map((run) => (
                <tr key={run.id} className="data-row">
                  <td className="tnum py-2 pr-3" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {new Date(run.finishedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="py-2 pr-3" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    {run.clientId}
                  </td>
                  <td className="py-2 pr-3" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {run.source === "ads" ? "Mídia" : "CRM"}
                  </td>
                  <td className="tnum py-2 pr-3" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {br(run.rangeFrom)} – {br(run.rangeTo)}
                  </td>
                  <td className="tnum py-2 pr-3" style={{ borderBottom: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    {run.rows.toLocaleString("pt-BR")}
                  </td>
                  <td
                    className="py-2 pr-3"
                    style={{
                      borderBottom: "1px solid var(--border)",
                      color: run.status === "ok" ? "var(--good)" : "var(--critical)",
                    }}
                    title={run.error || undefined}
                  >
                    {run.status === "ok" ? "ok" : run.error?.slice(0, 60) || "erro"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!(info.execucoes || []).length ? (
            <p className="py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
              Nenhuma coleta registrada ainda.
            </p>
          ) : null}
        </div>
      </section>

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Banco em <code>{info.arquivo}</code>. A coleta automática roda por cron; este botão serve para forçar agora ou
        para preencher o passado.
      </p>
    </div>
  );
}
