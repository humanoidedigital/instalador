"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Notice, SaveBar, fromList, toList } from "./shared";

interface ClientRow {
  id: string;
  name: string;
  currency?: string;
  metaAccountIds?: string[];
  googleAccountIds?: string[];
  rdCrmTokenEnv?: string;
  rdCrmPipelines?: string[];
  goals?: { cpl?: number | null; roas?: number | null; monthlyBudget?: number | null; monthlyLeads?: number | null };
  active?: boolean;
  tokenDefinido?: boolean;
}

/** Nome da variável de ambiente sugerido a partir do identificador do cliente. */
function tokenEnvFor(id: string): string {
  const slug = id.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug ? `RD_CRM_TOKEN_${slug}` : "";
}

function emptyClient(): ClientRow {
  return {
    id: "",
    name: "",
    currency: "BRL",
    metaAccountIds: [],
    googleAccountIds: [],
    rdCrmTokenEnv: "",
    rdCrmPipelines: [],
    goals: { cpl: null, roas: null, monthlyBudget: null, monthlyLeads: null },
    active: true,
  };
}

export function ClientsTab() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [original, setOriginal] = useState<string>("[]");
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<number | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "erro" | "aviso"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/admin/clients")
      .then((response) => response.json())
      .then((body: { clients: ClientRow[] }) => {
        setClients(body.clients || []);
        setOriginal(JSON.stringify(body.clients || []));
      })
      .catch(() => setStatus({ tone: "erro", text: "Não foi possível carregar a lista de clientes." }));
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(clients) !== original || Object.values(tokens).some(Boolean),
    [clients, original, tokens],
  );

  function update(index: number, patch: Partial<ClientRow>) {
    setClients((current) => current.map((client, i) => (i === index ? { ...client, ...patch } : client)));
  }

  function updateGoal(index: number, key: keyof NonNullable<ClientRow["goals"]>, value: string) {
    setClients((current) =>
      current.map((client, i) =>
        i === index ? { ...client, goals: { ...client.goals, [key]: value === "" ? null : Number(value) } } : client,
      ),
    );
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Falha ao salvar.");

      // Tokens digitados vão para o cofre, não para o clients.json.
      const values = Object.fromEntries(Object.entries(tokens).filter(([, value]) => value.trim()));
      if (Object.keys(values).length) {
        const secretsResponse = await fetch("/api/admin/secrets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values }),
        });
        if (!secretsResponse.ok) {
          const secretsBody = (await secretsResponse.json()) as { error?: string };
          throw new Error(secretsBody.error || "Clientes salvos, mas os tokens não.");
        }
      }

      setOriginal(JSON.stringify(clients));
      setTokens({});
      setStatus({ tone: "ok", text: "Clientes salvos. O relatório já usa a nova configuração." });
      const refreshed = await fetch("/api/admin/clients").then((r) => r.json());
      setClients(refreshed.clients || []);
      setOriginal(JSON.stringify(refreshed.clients || []));
    } catch (error) {
      setStatus({ tone: "erro", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(client: ClientRow) {
    setTesting(client.id);
    setTestResult((current) => ({ ...current, [client.id]: "" }));
    try {
      const response = await fetch(`/api/crm-check?client=${encodeURIComponent(client.id)}&preset=last_30d`);
      const body = (await response.json()) as {
        clientes?: { ok: boolean; motivo?: string; dealsRetornados?: number; etapasCarregadas?: number }[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Falha no teste.");
      const result = body.clientes?.[0];
      setTestResult((current) => ({
        ...current,
        [client.id]: result?.ok
          ? `OK — ${result.dealsRetornados} negociações e ${result.etapasCarregadas} etapas nos últimos 30 dias.`
          : `Falhou — ${result?.motivo || "sem detalhes"}`,
      }));
    } catch (error) {
      setTestResult((current) => ({ ...current, [client.id]: `Falhou — ${(error as Error).message}` }));
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {clients.length} cliente(s). O relatório reflete as mudanças assim que você salva.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="control"
            onClick={() => {
              setClients((current) => [...current, emptyClient()]);
              setOpen(clients.length);
            }}
          >
            + Novo cliente
          </button>
          <SaveBar dirty={dirty} saving={saving} onSave={save} />
        </div>
      </div>

      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}

      <ul className="space-y-3">
        {clients.map((client, index) => {
          const expanded = open === index;
          const envName = client.rdCrmTokenEnv || tokenEnvFor(client.id);

          return (
            <li key={`${client.id}-${index}`} className="card p-4">
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
                      {client.name || "(sem nome)"}
                    </span>
                    <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {client.id || "sem identificador"} · {(client.metaAccountIds || []).length} conta(s) Meta ·{" "}
                      {(client.googleAccountIds || []).length} conta(s) Google ·{" "}
                      {client.tokenDefinido ? "CRM conectado" : "CRM sem token"}
                    </span>
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="control text-xs"
                    onClick={() => testConnection(client)}
                    disabled={testing === client.id || !client.id}
                  >
                    {testing === client.id ? "Testando…" : "Testar CRM"}
                  </button>
                  <button
                    type="button"
                    className="control text-xs"
                    style={{ color: "var(--critical)" }}
                    onClick={() => {
                      if (confirm(`Remover "${client.name || client.id}" da lista?`)) {
                        setClients((current) => current.filter((_, i) => i !== index));
                      }
                    }}
                  >
                    Remover
                  </button>
                </div>
              </div>

              {testResult[client.id] ? (
                <p
                  className="mt-2 text-[11px]"
                  style={{ color: testResult[client.id].startsWith("OK") ? "var(--good)" : "var(--critical)" }}
                >
                  {testResult[client.id]}
                </p>
              ) : null}

              {expanded ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field label="Nome do cliente">
                    <input
                      className="control w-full"
                      value={client.name}
                      onChange={(event) => update(index, { name: event.target.value })}
                    />
                  </Field>
                  <Field label="Identificador" help="Aparece na URL. Letras minúsculas, números e hífen.">
                    <input
                      className="control w-full"
                      value={client.id}
                      onChange={(event) => update(index, { id: event.target.value })}
                    />
                  </Field>

                  <Field label="Contas do Meta Ads" help="IDs separados por vírgula, sem o prefixo act_.">
                    <input
                      className="control w-full"
                      value={fromList(client.metaAccountIds)}
                      onChange={(event) => update(index, { metaAccountIds: toList(event.target.value) })}
                    />
                  </Field>
                  <Field label="Contas do Google Ads" help="IDs separados por vírgula, com ou sem hífen.">
                    <input
                      className="control w-full"
                      value={fromList(client.googleAccountIds)}
                      onChange={(event) => update(index, { googleAccountIds: toList(event.target.value) })}
                    />
                  </Field>

                  <Field
                    label="Token do RD Station CRM deste cliente"
                    help={
                      client.tokenDefinido
                        ? `Já definido em ${envName}. Digite um novo valor só para substituir.`
                        : `Será guardado no cofre como ${envName}. Deixe vazio para usar o token global.`
                    }
                  >
                    <input
                      className="control w-full"
                      type="password"
                      placeholder={client.tokenDefinido ? "••••••••" : "cole o token aqui"}
                      value={tokens[envName] || ""}
                      onChange={(event) => {
                        setTokens((current) => ({ ...current, [envName]: event.target.value }));
                        if (!client.rdCrmTokenEnv) update(index, { rdCrmTokenEnv: envName });
                      }}
                    />
                  </Field>
                  <Field
                    label="Funis do CRM"
                    help="Só quando vários clientes dividem a mesma conta de CRM. Vazio = todos os funis."
                  >
                    <input
                      className="control w-full"
                      value={fromList(client.rdCrmPipelines)}
                      onChange={(event) => update(index, { rdCrmPipelines: toList(event.target.value) })}
                    />
                  </Field>

                  <Field label="Meta de CPL (R$)">
                    <input
                      className="control w-full"
                      type="number"
                      min="0"
                      step="0.01"
                      value={client.goals?.cpl ?? ""}
                      onChange={(event) => updateGoal(index, "cpl", event.target.value)}
                    />
                  </Field>
                  <Field label="Meta de ROAS (x)">
                    <input
                      className="control w-full"
                      type="number"
                      min="0"
                      step="0.1"
                      value={client.goals?.roas ?? ""}
                      onChange={(event) => updateGoal(index, "roas", event.target.value)}
                    />
                  </Field>
                  <Field label="Investimento planejado no mês (R$)">
                    <input
                      className="control w-full"
                      type="number"
                      min="0"
                      value={client.goals?.monthlyBudget ?? ""}
                      onChange={(event) => updateGoal(index, "monthlyBudget", event.target.value)}
                    />
                  </Field>
                  <Field label="Meta de leads no mês">
                    <input
                      className="control w-full"
                      type="number"
                      min="0"
                      value={client.goals?.monthlyLeads ?? ""}
                      onChange={(event) => updateGoal(index, "monthlyLeads", event.target.value)}
                    />
                  </Field>

                  <Field label="Situação" help="Cliente inativo some do seletor sem perder a configuração.">
                    <select
                      className="control w-full"
                      value={client.active === false ? "inativo" : "ativo"}
                      onChange={(event) => update(index, { active: event.target.value === "ativo" })}
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </Field>
                  <Field label="Moeda">
                    <input
                      className="control w-full"
                      value={client.currency || "BRL"}
                      onChange={(event) => update(index, { currency: event.target.value.toUpperCase() })}
                    />
                  </Field>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {clients.length ? <SaveBar dirty={dirty} saving={saving} onSave={save} /> : null}
    </div>
  );
}
