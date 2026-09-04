"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Notice, SaveBar } from "./shared";

interface SettingField {
  key: string;
  label: string;
  help?: string;
  type: "text" | "password" | "select" | "number";
  options?: { value: string; label: string }[];
  placeholder?: string;
  value: string;
  masked: string;
  definido: boolean;
  origem: "cofre" | "ambiente" | "vazio";
}

interface Group {
  id: string;
  title: string;
  description: string;
  fields: SettingField[];
}

interface ClientToken extends SettingField {
  clientId: string;
  clientName: string;
}

const ORIGEM_LABEL: Record<SettingField["origem"], string> = {
  cofre: "salvo no painel",
  ambiente: "vindo do .env",
  vazio: "não definido",
};

export function ConnectionsTab() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [clientTokens, setClientTokens] = useState<ClientToken[]>([]);
  const [cofre, setCofre] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [cleared, setCleared] = useState<string[]>([]);
  const [status, setStatus] = useState<{ tone: "ok" | "erro" | "aviso"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const body = (await fetch("/api/admin/secrets").then((r) => r.json())) as {
      groups: Group[];
      clientTokens: ClientToken[];
      cofre: string;
    };
    setGroups(body.groups || []);
    setClientTokens(body.clientTokens || []);
    setCofre(body.cofre || "");
    setEdits({});
    setCleared([]);
  }

  useEffect(() => {
    load().catch(() => setStatus({ tone: "erro", text: "Não foi possível carregar as configurações." }));
  }, []);

  const dirty = useMemo(
    () => Object.values(edits).some((value) => value !== "") || cleared.length > 0,
    [edits, cleared],
  );

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/secrets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: edits, clear: cleared }),
      });
      const body = (await response.json()) as { error?: string; alterados?: number };
      if (!response.ok) throw new Error(body.error || "Falha ao salvar.");
      await load();
      setStatus({
        tone: "ok",
        text: `${body.alterados || 0} configuração(ões) salva(s). Vale imediatamente, sem reiniciar o servidor.`,
      });
    } catch (error) {
      setStatus({ tone: "erro", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: SettingField) {
    const pendingClear = cleared.includes(field.key);

    if (field.type === "select") {
      return (
        <select
          className="control w-full"
          value={edits[field.key] ?? field.value}
          onChange={(event) => setEdits((current) => ({ ...current, [field.key]: event.target.value }))}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "password") {
      return (
        <div className="flex items-center gap-2">
          <input
            className="control w-full"
            type="password"
            placeholder={field.definido ? field.masked : field.placeholder || "não definido"}
            value={edits[field.key] || ""}
            onChange={(event) => setEdits((current) => ({ ...current, [field.key]: event.target.value }))}
            disabled={pendingClear}
          />
          {field.definido ? (
            <button
              type="button"
              className="control shrink-0 text-xs"
              style={{ color: pendingClear ? "var(--text-muted)" : "var(--critical)" }}
              onClick={() =>
                setCleared((current) =>
                  pendingClear ? current.filter((key) => key !== field.key) : [...current, field.key],
                )
              }
            >
              {pendingClear ? "Desfazer" : "Apagar"}
            </button>
          ) : null}
        </div>
      );
    }

    return (
      <input
        className="control w-full"
        type={field.type === "number" ? "number" : "text"}
        placeholder={field.placeholder}
        value={edits[field.key] ?? field.value}
        onChange={(event) => setEdits((current) => ({ ...current, [field.key]: event.target.value }))}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Credenciais gravadas em <code>{cofre}</code> com permissão 600. Campos de senha nunca são exibidos de volta —
          só a máscara.
        </p>
        <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => load()} />
      </div>

      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}

      {groups.map((group) => (
        <section key={group.id} className="card p-4">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {group.title}
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            {group.description}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {group.fields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                help={`${field.help ? `${field.help} ` : ""}(${ORIGEM_LABEL[field.origem]})`}
              >
                {renderField(field)}
              </Field>
            ))}
          </div>
        </section>
      ))}

      {clientTokens.length ? (
        <section className="card p-4">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Tokens por cliente
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            Uma conta de RD Station CRM por cliente. Também dá para editar na aba Clientes.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {clientTokens.map((token) => (
              <Field
                key={token.key}
                label={token.clientName}
                help={`${token.key} (${ORIGEM_LABEL[token.origem]})`}
              >
                {renderField(token)}
              </Field>
            ))}
          </div>
        </section>
      ) : null}

      <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => load()} />
    </div>
  );
}
