"use client";

import { useState } from "react";
import { Field, Notice } from "./shared";

export function AccessTab({ user }: { user: string }) {
  const [usuario, setUsuario] = useState(user);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "erro" | "aviso"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);

    if (nova !== confirmacao) {
      setStatus({ tone: "erro", text: "A nova senha e a confirmação não conferem." });
      return;
    }
    if (nova.length < 10) {
      setStatus({ tone: "erro", text: "A nova senha precisa ter pelo menos 10 caracteres." });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, atual, nova }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Falha ao trocar a senha.");

      setAtual("");
      setNova("");
      setConfirmacao("");
      setStatus({ tone: "ok", text: "Credenciais master atualizadas. A senha fica guardada como hash." });
    } catch (error) {
      setStatus({ tone: "erro", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card max-w-lg p-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Credenciais master
        </h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          Quem tem esta senha administra tudo: clientes, tokens e acessos.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="Usuário">
            <input className="control w-full" value={usuario} onChange={(event) => setUsuario(event.target.value)} />
          </Field>
          <Field label="Senha atual">
            <input
              className="control w-full"
              type="password"
              value={atual}
              onChange={(event) => setAtual(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="Nova senha" help="Mínimo de 10 caracteres. Guardada como hash scrypt, nunca em texto puro.">
            <input
              className="control w-full"
              type="password"
              value={nova}
              onChange={(event) => setNova(event.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Repita a nova senha">
            <input
              className="control w-full"
              type="password"
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
        </div>

        {status ? (
          <div className="mt-3">
            <Notice tone={status.tone}>{status.text}</Notice>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="control mt-4 font-medium"
          style={{ background: "var(--series-1)", borderColor: "var(--series-1)", color: "#fff", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Salvando…" : "Trocar credenciais"}
        </button>
      </form>

      <p className="max-w-lg text-xs" style={{ color: "var(--text-muted)" }}>
        Para dar acesso só de leitura a alguém — cliente ou pessoa do time que não deve mexer em configuração —, defina
        a “Senha de leitura” na aba Conexões. Quem entrar com ela vê os relatórios e não abre esta área.
      </p>
    </div>
  );
}
