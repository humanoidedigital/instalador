"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Notice, SaveBar } from "./shared";

interface CustomMetric {
  id: string;
  label: string;
  formula: string;
  format: "currency" | "number" | "percent" | "decimal" | "days";
  higherIsBetter: boolean;
  goal: number | null;
  hint: string;
  enabled: boolean;
  clients: string[];
}

interface FieldDefinition {
  id: string;
  label: string;
  description: string;
}

const FORMATS = [
  { value: "currency", label: "Moeda (R$)" },
  { value: "percent", label: "Porcentagem" },
  { value: "decimal", label: "Número com decimais" },
  { value: "number", label: "Número inteiro" },
  { value: "days", label: "Dias" },
] as const;

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 39);
}

function novaMetrica(): CustomMetric {
  return {
    id: "",
    label: "",
    formula: "",
    format: "decimal",
    higherIsBetter: true,
    goal: null,
    hint: "",
    enabled: true,
    clients: [],
  };
}

export function MetricsTab() {
  const [metrics, setMetrics] = useState<CustomMetric[]>([]);
  const [original, setOriginal] = useState("[]");
  const [campos, setCampos] = useState<FieldDefinition[]>([]);
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [arquivo, setArquivo] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "erro" | "aviso"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Record<number, string>>({});
  const [testing, setTesting] = useState<number | null>(null);

  async function load() {
    const body = (await fetch("/api/admin/metrics").then((r) => r.json())) as {
      metrics: CustomMetric[];
      campos: FieldDefinition[];
      arquivo: string;
      clientes: { id: string; name: string }[];
    };
    setMetrics(body.metrics || []);
    setOriginal(JSON.stringify(body.metrics || []));
    setCampos(body.campos || []);
    setClientes(body.clientes || []);
    setArquivo(body.arquivo || "");
  }

  useEffect(() => {
    load().catch(() => setStatus({ tone: "erro", text: "Não foi possível carregar as métricas." }));
  }, []);

  const dirty = useMemo(() => JSON.stringify(metrics) !== original, [metrics, original]);

  function update(index: number, patch: Partial<CustomMetric>) {
    setMetrics((current) => current.map((metric, i) => (i === index ? { ...metric, ...patch } : metric)));
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/metrics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics }),
      });
      const body = (await response.json()) as { error?: string; total?: number };
      if (!response.ok) throw new Error(body.error || "Falha ao salvar.");
      await load();
      setStatus({ tone: "ok", text: `${body.total} métrica(s) salva(s). Já aparecem no relatório.` });
    } catch (error) {
      setStatus({ tone: "erro", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function testar(index: number) {
    setTesting(index);
    setPreview((current) => ({ ...current, [index]: "" }));
    try {
      const response = await fetch("/api/admin/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formula: metrics[index].formula }),
      });
      const body = (await response.json()) as { valor?: number | null; error?: string; aviso?: string };
      if (!response.ok) throw new Error(body.error || "Falha no teste.");

      const valor =
        body.valor === null || body.valor === undefined
          ? "sem valor (divisão por zero ou dados ausentes)"
          : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(body.valor);
      setPreview((current) => ({
        ...current,
        [index]: `Últimos 30 dias, todos os clientes: ${valor}${body.aviso ? ` — ${body.aviso}` : ""}`,
      }));
    } catch (error) {
      setPreview((current) => ({ ...current, [index]: `Erro: ${(error as Error).message}` }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {metrics.length} métrica(s). Elas viram cards na seção “Métricas personalizadas” do relatório.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="control"
            onClick={() => {
              setMetrics((current) => [...current, novaMetrica()]);
              setOpen(metrics.length);
            }}
          >
            + Nova métrica
          </button>
          <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => load()} />
        </div>
      </div>

      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}

      <section className="card p-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Campos disponíveis
        </h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          Use estes nomes na fórmula, com <code>+ - * / ( )</code> e as funções <code>min</code>, <code>max</code>,{" "}
          <code>abs</code> e <code>round</code>. Divisão por zero devolve vazio, não infinito.
        </p>
        <ul className="mt-3 grid gap-x-6 gap-y-1 md:grid-cols-2 lg:grid-cols-3">
          {campos.map((campo) => (
            <li key={campo.id} className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              <code style={{ color: "var(--series-1)" }}>{campo.id}</code> — {campo.description}
            </li>
          ))}
        </ul>
      </section>

      <ul className="space-y-3">
        {metrics.map((metric, index) => {
          const expanded = open === index;
          return (
            <li key={index} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 text-left"
                  onClick={() => setOpen(expanded ? null : index)}
                  aria-expanded={expanded}
                >
                  <span aria-hidden style={{ color: "var(--text-muted)" }}>
                    {expanded ? "▾" : "▸"}
                  </span>
                  <span>
                    <span className="block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {metric.label || "(sem nome)"}
                    </span>
                    <span className="block font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {metric.formula || "sem fórmula"}
                      {!metric.enabled ? " · desativada" : ""}
                      {metric.clients.length ? ` · ${metric.clients.length} cliente(s)` : ""}
                    </span>
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="control text-xs"
                    onClick={() => testar(index)}
                    disabled={testing === index || !metric.formula}
                  >
                    {testing === index ? "Testando…" : "Testar"}
                  </button>
                  <button
                    type="button"
                    className="control text-xs"
                    style={{ color: "var(--critical)" }}
                    onClick={() => {
                      if (confirm(`Remover a métrica "${metric.label || metric.id}"?`)) {
                        setMetrics((current) => current.filter((_, i) => i !== index));
                        setOpen(null);
                      }
                    }}
                  >
                    Remover
                  </button>
                </div>
              </div>

              {preview[index] ? (
                <p
                  className="mt-2 text-[11px]"
                  style={{ color: preview[index].startsWith("Erro") ? "var(--critical)" : "var(--good)" }}
                >
                  {preview[index]}
                </p>
              ) : null}

              {expanded ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field label="Nome do indicador">
                    <input
                      className="control w-full"
                      value={metric.label}
                      onChange={(event) => {
                        const label = event.target.value;
                        update(index, { label, id: metric.id || slug(label) });
                      }}
                    />
                  </Field>
                  <Field label="Identificador" help="Gerado a partir do nome. Só minúsculas, números e hífen.">
                    <input
                      className="control w-full"
                      value={metric.id}
                      onChange={(event) => update(index, { id: slug(event.target.value) })}
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Fórmula" help="Ex.: (receita - investimento) / investimento">
                      <input
                        className="control w-full font-mono"
                        value={metric.formula}
                        onChange={(event) => update(index, { formula: event.target.value })}
                        placeholder="receita / investimento"
                        spellCheck={false}
                      />
                    </Field>
                  </div>

                  <Field label="Formato">
                    <select
                      className="control w-full"
                      value={metric.format}
                      onChange={(event) => update(index, { format: event.target.value as CustomMetric["format"] })}
                    >
                      {FORMATS.map((format) => (
                        <option key={format.value} value={format.value}>
                          {format.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Direção" help="Define a cor da variação contra o período anterior.">
                    <select
                      className="control w-full"
                      value={metric.higherIsBetter ? "sobe" : "desce"}
                      onChange={(event) => update(index, { higherIsBetter: event.target.value === "sobe" })}
                    >
                      <option value="sobe">Subir é bom</option>
                      <option value="desce">Descer é bom</option>
                    </select>
                  </Field>

                  <Field label="Meta" help="Opcional. Mostra a barra de progresso no card.">
                    <input
                      className="control w-full"
                      type="number"
                      step="0.01"
                      value={metric.goal ?? ""}
                      onChange={(event) =>
                        update(index, { goal: event.target.value === "" ? null : Number(event.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Situação">
                    <select
                      className="control w-full"
                      value={metric.enabled ? "ativa" : "inativa"}
                      onChange={(event) => update(index, { enabled: event.target.value === "ativa" })}
                    >
                      <option value="ativa">Ativa</option>
                      <option value="inativa">Inativa</option>
                    </select>
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Explicação" help="Aparece ao passar o mouse no card do relatório.">
                      <input
                        className="control w-full"
                        value={metric.hint}
                        onChange={(event) => update(index, { hint: event.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="md:col-span-2">
                    <Field label="Clientes" help="Nenhum marcado = vale para todos.">
                      <div className="flex flex-wrap gap-3">
                        {clientes.map((cliente) => (
                          <label key={cliente.id} className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={metric.clients.includes(cliente.id)}
                              onChange={(event) =>
                                update(index, {
                                  clients: event.target.checked
                                    ? [...metric.clients, cliente.id]
                                    : metric.clients.filter((id) => id !== cliente.id),
                                })
                              }
                            />
                            <span style={{ color: "var(--text-secondary)" }}>{cliente.name}</span>
                          </label>
                        ))}
                      </div>
                    </Field>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {metrics.length ? <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => load()} /> : null}

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Gravadas em <code>{arquivo}</code>.
      </p>
    </div>
  );
}
