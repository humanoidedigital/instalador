"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Notice, SaveBar } from "./shared";

interface SourceRow {
  id: string;
  label: string;
  connector: string;
  purpose: string;
  onboard: string;
  enabled: boolean;
  dimensionLabel: string;
  fields: Record<string, string>;
  clientes: number;
}

interface FieldRow {
  id: string;
  hint: string;
}

interface CheckSource {
  fonte: string;
  rotulo: string;
  conector: string;
  ativa: boolean;
  contas: number;
  onboard: string;
  ok?: boolean;
  camposRecebidos?: string[];
  camposAusentes?: string[];
  naoMapeados?: string[];
  linhas?: number;
  erro?: string;
}

export function OrganicTab() {
  const [fontes, setFontes] = useState<SourceRow[]>([]);
  const [original, setOriginal] = useState("[]");
  const [campos, setCampos] = useState<FieldRow[]>([]);
  const [arquivo, setArquivo] = useState("");
  const [windsor, setWindsor] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "erro" | "aviso"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<CheckSource[] | null>(null);

  async function load() {
    const body = (await fetch("/api/admin/organic").then((r) => r.json())) as {
      fontes: SourceRow[];
      campos: FieldRow[];
      arquivo: string;
      windsorConfigurado: boolean;
    };
    setFontes(body.fontes || []);
    setOriginal(JSON.stringify(body.fontes || []));
    setCampos(body.campos || []);
    setArquivo(body.arquivo || "");
    setWindsor(Boolean(body.windsorConfigurado));
  }

  useEffect(() => {
    load().catch(() => setStatus({ tone: "erro", text: "Não foi possível carregar as fontes de orgânico." }));
  }, []);

  const dirty = useMemo(() => JSON.stringify(fontes) !== original, [fontes, original]);

  function update(id: string, patch: Partial<SourceRow>) {
    setFontes((current) => current.map((source) => (source.id === id ? { ...source, ...patch } : source)));
  }

  function updateField(id: string, field: string, value: string) {
    setFontes((current) =>
      current.map((source) =>
        source.id === id ? { ...source, fields: { ...source.fields, [field]: value } } : source,
      ),
    );
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const sources = Object.fromEntries(
        fontes.map((source) => [
          source.id,
          {
            enabled: source.enabled,
            connector: source.connector,
            dimensionLabel: source.dimensionLabel,
            fields: source.fields,
          },
        ]),
      );

      const response = await fetch("/api/admin/organic", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Falha ao salvar.");
      await load();
      setStatus({ tone: "ok", text: "Fontes salvas." });
    } catch (error) {
      setStatus({ tone: "erro", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function conferir() {
    setChecking(true);
    setStatus(null);
    setCheck(null);
    try {
      const response = await fetch("/api/organic-check?days=7");
      const body = (await response.json()) as { fontes?: CheckSource[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Falha no diagnóstico.");
      setCheck(body.fontes || []);
    } catch (error) {
      setStatus({ tone: "erro", text: (error as Error).message });
    } finally {
      setChecking(false);
    }
  }

  const ativas = fontes.filter((source) => source.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {ativas} de {fontes.length} fonte(s) ativa(s). Enquanto nenhuma estiver ativa, os blocos de orgânico usam
          dados de demonstração.
        </p>
        <div className="flex items-center gap-2">
          <button type="button" className="control" onClick={conferir} disabled={checking || !windsor}>
            {checking ? "Conferindo…" : "Conferir campos"}
          </button>
          <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => load()} />
        </div>
      </div>

      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}

      <Notice tone="aviso">
        Os IDs de campo destas fontes ainda <strong>não foram conferidos contra contas reais</strong>: a Windsor só
        lista os campos de um conector depois que existe uma conta conectada, e hoje só Meta Ads e Google Ads estão.
        Os valores abaixo seguem a convenção dos conectores já validados. Conecte a conta, use{" "}
        <strong>Conferir campos</strong> e corrija o que não vier.
      </Notice>

      {!windsor ? (
        <Notice tone="erro">
          WINDSOR_API_KEY não configurada. Preencha em Conexões antes de ativar qualquer fonte.
        </Notice>
      ) : null}

      <ul className="space-y-3">
        {fontes.map((source) => {
          const expanded = open === source.id;
          const resultado = check?.find((item) => item.fonte === source.id);
          return (
            <li key={source.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 text-left"
                  onClick={() => setOpen(expanded ? null : source.id)}
                  aria-expanded={expanded}
                >
                  <span aria-hidden style={{ color: "var(--text-muted)" }}>
                    {expanded ? "▾" : "▸"}
                  </span>
                  <span>
                    <span className="block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {source.label}
                    </span>
                    <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {source.purpose} · conector <code>{source.connector}</code> ·{" "}
                      {source.clientes} cliente(s) com conta
                    </span>
                  </span>
                </button>

                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={source.enabled}
                    onChange={(event) => update(source.id, { enabled: event.target.checked })}
                  />
                  <span style={{ color: "var(--text-secondary)" }}>Ativa</span>
                </label>
              </div>

              {resultado ? (
                <div className="mt-3 rounded-lg p-3 text-[11px]" style={{ background: "var(--surface-2)" }}>
                  {resultado.ok ? (
                    <>
                      <p style={{ color: resultado.camposAusentes?.length ? "var(--warning)" : "var(--good)" }}>
                        {resultado.linhas} linha(s) de amostra ·{" "}
                        {resultado.camposAusentes?.length
                          ? `${resultado.camposAusentes.length} campo(s) do mapa não vieram`
                          : "todos os campos do mapa vieram"}
                      </p>
                      {resultado.camposAusentes?.length ? (
                        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
                          Faltando: {resultado.camposAusentes.join(", ")}
                        </p>
                      ) : null}
                      {resultado.camposRecebidos?.length ? (
                        <p className="mt-1" style={{ color: "var(--text-muted)" }}>
                          Recebidos: {resultado.camposRecebidos.join(", ")}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p style={{ color: "var(--critical)" }}>{resultado.erro}</p>
                  )}
                </div>
              ) : null}

              {expanded ? (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Conector da Windsor" help="Slug usado na URL da API.">
                      <input
                        className="control w-full font-mono"
                        value={source.connector}
                        onChange={(event) => update(source.id, { connector: event.target.value })}
                        spellCheck={false}
                      />
                    </Field>
                    <Field label="Nome do agrupador" help="Como esta dimensão aparece nas tabelas.">
                      <input
                        className="control w-full"
                        value={source.dimensionLabel}
                        onChange={(event) => update(source.id, { dimensionLabel: event.target.value })}
                      />
                    </Field>
                  </div>

                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    Campo em branco significa “esta fonte não tem este número” — ele fica de fora da consulta e dos
                    cálculos, em vez de entrar como zero.{" "}
                    <a href={source.onboard} target="_blank" rel="noreferrer" style={{ color: "var(--series-1)" }}>
                      Conectar conta na Windsor
                    </a>
                  </p>

                  <div className="grid gap-3 md:grid-cols-2">
                    {campos.map((campo) => (
                      <Field key={campo.id} label={campo.id} help={campo.hint}>
                        <input
                          className="control w-full font-mono"
                          value={source.fields[campo.id] || ""}
                          onChange={(event) => updateField(source.id, campo.id, event.target.value)}
                          placeholder="(não usar)"
                          spellCheck={false}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {fontes.length ? <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => load()} /> : null}

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Gravadas em <code>{arquivo}</code>. As contas de cada cliente ficam em Administração › Clientes.
      </p>
    </div>
  );
}
