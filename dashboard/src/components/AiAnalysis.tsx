"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardPayload } from "@/lib/types";

interface Insight {
  titulo: string;
  severidade: "positivo" | "atencao" | "critico" | "informativo";
  analise: string;
  acao: string;
}

interface AnalysisResponse {
  analysis?: { resumo: string; insights: Insight[] };
  model?: string;
  provider?: string;
  geradoEm?: string;
  doCache?: boolean;
  error?: string;
}

const TONE: Record<Insight["severidade"], { color: string; icon: string; label: string }> = {
  positivo: { color: "var(--good)", icon: "✓", label: "Positivo" },
  atencao: { color: "var(--warning)", icon: "!", label: "Atenção" },
  critico: { color: "var(--critical)", icon: "✕", label: "Crítico" },
  informativo: { color: "var(--series-1)", icon: "i", label: "Informação" },
};

export function AiAnalysis({ data, isMaster }: { data: DashboardPayload; isMaster: boolean }) {
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [status, setStatus] = useState<{ configurado: boolean; motivo?: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/insights")
      .then((response) => response.json())
      .then(setStatus)
      .catch(() => setStatus({ configurado: false, motivo: "Não foi possível checar a configuração da IA." }));
  }, []);

  const gerar = useCallback(
    async (forcar: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: data, forcar }),
        });
        const body = (await response.json()) as AnalysisResponse;
        if (!response.ok) throw new Error(body.error || "Falha ao gerar a análise.");
        setResult(body);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [data],
  );

  // Busca silenciosa do que já está em cache: se existir, aparece sozinho;
  // se não, ninguém gastou token à toa.
  useEffect(() => {
    if (!status?.configurado) return;
    let cancelled = false;
    fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: data, forcar: false, apenasCache: true }),
    })
      .then(async (response) => {
        const body = (await response.json()) as AnalysisResponse;
        if (!cancelled && response.ok && body.doCache) setResult(body);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Só quando o período ou o cliente mudam — não a cada render.
  }, [status?.configurado, data.meta.clientId, data.meta.range.from, data.meta.range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status && !status.configurado) {
    // Para quem não pode gerar, o motivo é assunto de operação da agência.
    if (!isMaster) return null;
    return (
      <div className="card p-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        {status.motivo}
      </div>
    );
  }

  // Sem análise gerada e sem poder gerar, o bloco não tem o que mostrar: some
  // do relatório em vez de deixar um botão morto e um recado interno.
  if (!isMaster && !result) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="control no-print font-medium"
          onClick={() => gerar(!!result)}
          disabled={loading || !isMaster}
          style={{
            background: isMaster ? "var(--series-1)" : "var(--surface-2)",
            borderColor: isMaster ? "var(--series-1)" : "var(--border-strong)",
            color: isMaster ? "#fff" : "var(--text-muted)",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Analisando…" : result ? "Gerar de novo" : "Gerar análise"}
        </button>

        {result?.geradoEm ? (
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {result.provider} · {result.model} · gerada em{" "}
            {new Date(result.geradoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            {result.doCache ? " (do cache)" : ""}
          </span>
        ) : null}

        {!isMaster ? (
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Só a conta master gera novas análises.
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="card p-3 text-xs" role="alert" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      ) : null}

      {loading && !result ? <div className="card h-32 animate-pulse" /> : null}

      {result?.analysis ? (
        <>
          {result.analysis.resumo ? (
            <p className="card p-4 text-sm" style={{ color: "var(--text-primary)" }}>
              {result.analysis.resumo}
            </p>
          ) : null}

          <ul className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            {result.analysis.insights.map((insight, index) => {
              const tone = TONE[insight.severidade];
              return (
                <li key={index} className="card flex gap-3 p-4">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: `color-mix(in srgb, ${tone.color} 16%, transparent)`, color: tone.color }}
                  >
                    {tone.icon}
                  </span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      <span className="sr-only">{tone.label}: </span>
                      {insight.titulo}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                      {insight.analise}
                    </p>
                    {insight.acao ? (
                      <p className="mt-2 text-xs" style={{ color: "var(--text-primary)" }}>
                        <strong>Ação:</strong> {insight.acao}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Análise gerada por IA a partir dos números agregados do período. Confira antes de levar ao cliente.
          </p>
        </>
      ) : null}
    </div>
  );
}
