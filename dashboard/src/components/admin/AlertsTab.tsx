"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Notice, SaveBar } from "./shared";

type Severity = "critico" | "atencao" | "informativo";
type Scope = "cliente" | "campanha";
type Operator = ">" | ">=" | "<" | "<=";

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  clients: string[];
  scope: Scope;
  formula: string;
  operator: Operator;
  threshold: number;
  severity: Severity;
  windowDays: number;
  minSpend: number;
  message: string;
}

interface FieldDefinition {
  id: string;
  label: string;
  description: string;
}

interface AlertEvent {
  id: number;
  ruleName: string;
  clientName: string;
  severity: string;
  title: string;
  detail: string;
  firedOn: string;
}

const SEVERITIES: { value: Severity; label: string; color: string }[] = [
  { value: "critico", label: "Crítico", color: "var(--critical)" },
  { value: "atencao", label: "Atenção", color: "var(--warning)" },
  { value: "informativo", label: "Informativo", color: "var(--series-1)" },
];

const OPERATORS: { value: Operator; label: string }[] = [
  { value: ">", label: "maior que" },
  { value: ">=", label: "maior ou igual a" },
  { value: "<", label: "menor que" },
  { value: "<=", label: "menor ou igual a" },
];

function severityColor(severity: string): string {
  return SEVERITIES.find((item) => item.value === severity)?.color || "var(--text-muted)";
}

function severityLabel(severity: string): string {
  return SEVERITIES.find((item) => item.value === severity)?.label || severity;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 49);
}

function novaRegra(): AlertRule {
  return {
    id: "",
    name: "",
    enabled: true,
    clients: [],
    scope: "cliente",
    formula: "",
    operator: ">",
    threshold: 0,
    severity: "atencao",
    windowDays: 7,
    minSpend: 0,
    message: "",
  };
}

export function AlertsTab() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [original, setOriginal] = useState("[]");
  const [camposCliente, setCamposCliente] = useState<FieldDefinition[]>([]);
  const [camposCampanha, setCamposCampanha] = useState<FieldDefinition[]>([]);
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [arquivo, setArquivo] = useState("");
  const [webhook, setWebhook] = useState(false);
  const [historico, setHistorico] = useState<AlertEvent[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "erro" | "aviso"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  async function load() {
    const body = (await fetch("/api/admin/alerts").then((r) => r.json())) as {
      rules: AlertRule[];
      camposCliente: FieldDefinition[];
      camposCampanha: FieldDefinition[];
      clientes: { id: string; name: string }[];
      arquivo: string;
      webhookConfigurado: boolean;
      historico: AlertEvent[];
    };
    setRules(body.rules || []);
    setOriginal(JSON.stringify(body.rules || []));
    setCamposCliente(body.camposCliente || []);
    setCamposCampanha(body.camposCampanha || []);
    setClientes(body.clientes || []);
    setArquivo(body.arquivo || "");
    setWebhook(Boolean(body.webhookConfigurado));
    setHistorico(body.historico || []);
  }

  useEffect(() => {
    load().catch(() => setStatus({ tone: "erro", text: "Não foi possível carregar os alertas." }));
  }, []);

  const dirty = useMemo(() => JSON.stringify(rules) !== original, [rules, original]);

  function update(index: number, patch: Partial<AlertRule>) {
    setRules((current) => current.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      const body = (await response.json()) as { error?: string; total?: number };
      if (!response.ok) throw new Error(body.error || "Falha ao salvar.");
      await load();
      setStatus({ tone: "ok", text: `${body.total} regra(s) salva(s).` });
    } catch (error) {
      setStatus({ tone: "erro", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function rodarAgora() {
    setRunning(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/alerts", { method: "POST" });
      const body = (await response.json()) as {
        avaliados: number;
        disparos: number;
        novos: number;
        entregues: number;
        erros: string[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Falha ao rodar.");
      await load();

      const resumo =
        `${body.avaliados} cliente(s) avaliado(s), ${body.disparos} disparo(s), ` +
        `${body.novos} novo(s)${webhook ? `, ${body.entregues} enviado(s) ao webhook` : ""}.`;
      setStatus(
        body.erros.length
          ? { tone: "aviso", text: `${resumo} Problemas: ${body.erros.join(" ")}` }
          : { tone: "ok", text: resumo },
      );
    } catch (error) {
      setStatus({ tone: "erro", text: (error as Error).message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {rules.length} regra(s). Rodam junto com a coleta diária e aparecem no bloco “Alertas” do relatório.
        </p>
        <div className="flex items-center gap-2">
          <button type="button" className="control" onClick={rodarAgora} disabled={running || dirty}>
            {running ? "Rodando…" : "Rodar agora"}
          </button>
          <button
            type="button"
            className="control"
            onClick={() => {
              setRules((current) => [...current, novaRegra()]);
              setOpen(rules.length);
            }}
          >
            + Nova regra
          </button>
          <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => load()} />
        </div>
      </div>

      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}

      {!webhook ? (
        <Notice tone="aviso">
          Nenhum webhook configurado. Os alertas ficam no relatório e no histórico abaixo. Para receber no Slack,
          Discord ou n8n, preencha <code>ALERT_WEBHOOK_URL</code> em Conexões &rsaquo; Alertas.
        </Notice>
      ) : null}

      <section className="card p-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Como a regra funciona
        </h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          A fórmula é calculada na janela escolhida e comparada com o limiar. Se a conta não tiver resultado (divisão
          por zero, meta em branco), a regra simplesmente não dispara — um CPL sem leads não vira alerta de “CPL
          baixo”. Cada regra dispara no máximo uma vez por dia por cliente ou campanha.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              Campos no escopo do cliente
            </h4>
            <ul className="mt-1.5 space-y-1">
              {camposCliente.map((campo) => (
                <li key={campo.id} className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  <code style={{ color: "var(--series-1)" }}>{campo.id}</code> — {campo.description}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              Campos no escopo da campanha
            </h4>
            <ul className="mt-1.5 space-y-1">
              {camposCampanha.map((campo) => (
                <li key={campo.id} className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  <code style={{ color: "var(--series-1)" }}>{campo.id}</code> — {campo.description}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <ul className="space-y-3">
        {rules.map((rule, index) => {
          const expanded = open === index;
          const campos = rule.scope === "campanha" ? camposCampanha : camposCliente;
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
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: severityColor(rule.severity) }}
                      />
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {rule.name || "(sem nome)"}
                      </span>
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {rule.formula || "sem fórmula"} {rule.operator} {rule.threshold} · {rule.windowDays}d ·{" "}
                      {rule.scope}
                      {!rule.enabled ? " · desativada" : ""}
                      {rule.clients.length ? ` · ${rule.clients.length} cliente(s)` : ""}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className="control text-xs"
                  style={{ color: "var(--critical)" }}
                  onClick={() => {
                    if (confirm(`Remover a regra "${rule.name || rule.id}"?`)) {
                      setRules((current) => current.filter((_, i) => i !== index));
                      setOpen(null);
                    }
                  }}
                >
                  Remover
                </button>
              </div>

              {expanded ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field label="Nome da regra">
                    <input
                      className="control w-full"
                      value={rule.name}
                      onChange={(event) => {
                        const name = event.target.value;
                        update(index, { name, id: rule.id || slug(name) });
                      }}
                    />
                  </Field>
                  <Field label="Identificador" help="Gerado a partir do nome. Só minúsculas, números e hífen.">
                    <input
                      className="control w-full"
                      value={rule.id}
                      onChange={(event) => update(index, { id: slug(event.target.value) })}
                    />
                  </Field>

                  <Field label="Escopo" help="Cliente avalia o total; campanha avalia uma a uma.">
                    <select
                      className="control w-full"
                      value={rule.scope}
                      onChange={(event) => update(index, { scope: event.target.value as Scope })}
                    >
                      <option value="cliente">Cliente</option>
                      <option value="campanha">Campanha</option>
                    </select>
                  </Field>
                  <Field label="Janela" help="Quantos dias entram na conta.">
                    <select
                      className="control w-full"
                      value={rule.windowDays}
                      onChange={(event) => update(index, { windowDays: Number(event.target.value) })}
                    >
                      {[1, 3, 7, 14, 30].map((days) => (
                        <option key={days} value={days}>
                          {days} dia(s)
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="md:col-span-2">
                    <Field
                      label="Fórmula"
                      help={`Campos deste escopo: ${campos.map((campo) => campo.id).join(", ")}`}
                    >
                      <input
                        className="control w-full font-mono"
                        value={rule.formula}
                        onChange={(event) => update(index, { formula: event.target.value })}
                        placeholder="investimento / leads"
                        spellCheck={false}
                      />
                    </Field>
                  </div>

                  <Field label="Dispara quando o resultado for">
                    <select
                      className="control w-full"
                      value={rule.operator}
                      onChange={(event) => update(index, { operator: event.target.value as Operator })}
                    >
                      {OPERATORS.map((operator) => (
                        <option key={operator.value} value={operator.value}>
                          {operator.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Limiar">
                    <input
                      className="control w-full"
                      type="number"
                      step="0.01"
                      value={rule.threshold}
                      onChange={(event) => update(index, { threshold: Number(event.target.value) })}
                    />
                  </Field>

                  <Field label="Severidade">
                    <select
                      className="control w-full"
                      value={rule.severity}
                      onChange={(event) => update(index, { severity: event.target.value as Severity })}
                    >
                      {SEVERITIES.map((severity) => (
                        <option key={severity.value} value={severity.value}>
                          {severity.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Gasto mínimo"
                    help={
                      rule.scope === "campanha"
                        ? "Campanhas que gastaram menos que isto na janela são ignoradas."
                        : "Só vale no escopo de campanha."
                    }
                  >
                    <input
                      className="control w-full"
                      type="number"
                      step="1"
                      min="0"
                      value={rule.minSpend}
                      disabled={rule.scope !== "campanha"}
                      onChange={(event) => update(index, { minSpend: Number(event.target.value) })}
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <Field
                      label="Mensagem"
                      help="Aceita {valor}, {limiar}, {cliente} e {campanha}. Em branco, monta um texto automático."
                    >
                      <input
                        className="control w-full"
                        value={rule.message}
                        onChange={(event) => update(index, { message: event.target.value })}
                      />
                    </Field>
                  </div>

                  <Field label="Situação">
                    <select
                      className="control w-full"
                      value={rule.enabled ? "ativa" : "inativa"}
                      onChange={(event) => update(index, { enabled: event.target.value === "ativa" })}
                    >
                      <option value="ativa">Ativa</option>
                      <option value="inativa">Inativa</option>
                    </select>
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Clientes" help="Nenhum marcado = vale para todos.">
                      <div className="flex flex-wrap gap-3">
                        {clientes.map((cliente) => (
                          <label key={cliente.id} className="flex items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={rule.clients.includes(cliente.id)}
                              onChange={(event) =>
                                update(index, {
                                  clients: event.target.checked
                                    ? [...rule.clients, cliente.id]
                                    : rule.clients.filter((id) => id !== cliente.id),
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

      {rules.length ? <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => load()} /> : null}

      <section className="card p-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Disparos dos últimos 30 dias
        </h3>
        {historico.length ? (
          <ul className="mt-3 space-y-2">
            {historico.map((evento) => (
              <li key={evento.id} className="flex gap-2 text-xs">
                <span
                  aria-hidden
                  className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: severityColor(evento.severity) }}
                />
                <span>
                  <span style={{ color: "var(--text-primary)" }}>
                    {evento.clientName} — {evento.title}
                  </span>
                  <span className="block text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {evento.detail}
                  </span>
                  <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {severityLabel(evento.severity)} · {evento.firedOn}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            Nenhum disparo registrado ainda. Use “Rodar agora” para avaliar as regras contra o histórico já coletado.
          </p>
        )}
      </section>

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Gravadas em <code>{arquivo}</code>.
      </p>
    </div>
  );
}
