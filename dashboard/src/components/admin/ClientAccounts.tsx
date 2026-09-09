"use client";

import { useEffect, useState } from "react";
import { Field, Notice } from "./shared";

interface ClientUser {
  user: string;
  clientId: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

/** Sugere uma senha decente para quem não quer inventar uma. */
function suggestPassword(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => "abcdefghijkmnopqrstuvwxyz23456789"[byte % 33])
    .join("")
    .replace(/^(.{6})/, "$1-");
}

function formatDate(iso: string | null): string {
  if (!iso) return "nunca entrou";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function ClientAccounts() {
  const [usuarios, setUsuarios] = useState<ClientUser[]>([]);
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [arquivo, setArquivo] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "erro" | "aviso"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [novoUsuario, setNovoUsuario] = useState("");
  const [novoCliente, setNovoCliente] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [trocaSenha, setTrocaSenha] = useState<Record<string, string>>({});

  async function load() {
    const body = (await fetch("/api/admin/users").then((r) => r.json())) as {
      usuarios: ClientUser[];
      clientes: { id: string; name: string }[];
      arquivo: string;
    };
    setUsuarios(body.usuarios || []);
    setClientes(body.clientes || []);
    setArquivo(body.arquivo || "");
    if (!novoCliente && body.clientes?.length) setNovoCliente(body.clientes[0].id);
  }

  useEffect(() => {
    load().catch(() => setStatus({ tone: "erro", text: "Não foi possível carregar as contas." }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function call(method: string, body: unknown, sucesso: string, query = "") {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/admin/users${query}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "DELETE" ? undefined : JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Falha na operação.");
      await load();
      setStatus({ tone: "ok", text: sucesso });
      return true;
    } catch (error) {
      setStatus({ tone: "erro", text: (error as Error).message });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function criar(event: React.FormEvent) {
    event.preventDefault();
    const senha = novaSenha || suggestPassword();
    const ok = await call(
      "POST",
      { user: novoUsuario, clientId: novoCliente, password: senha },
      `Conta "${novoUsuario}" criada. Senha: ${senha} — anote agora, ela não aparece de novo.`,
    );
    if (ok) {
      setNovoUsuario("");
      setNovaSenha("");
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={criar} className="card p-4">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Contas de cliente
        </h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          Cada conta abre um relatório só — o do cliente escolhido. É o acesso para mandar ao cliente: ele não vê a
          carteira, não troca de cliente e não entra na administração.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Field label="Usuário" help="Minúsculas, números, ponto, hífen ou sublinhado.">
            <input
              className="control w-full"
              value={novoUsuario}
              onChange={(event) => setNovoUsuario(event.target.value.toLowerCase())}
              placeholder="isentei"
              required
            />
          </Field>
          <Field label="Cliente que enxerga">
            <select
              className="control w-full"
              value={novoCliente}
              onChange={(event) => setNovoCliente(event.target.value)}
            >
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Senha" help="Vazio gera uma automática. Mínimo de 8 caracteres.">
            <input
              className="control w-full"
              value={novaSenha}
              onChange={(event) => setNovaSenha(event.target.value)}
              placeholder="(gerar automática)"
              autoComplete="new-password"
            />
          </Field>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving || !novoUsuario || !novoCliente}
              className="control font-medium"
              style={{ background: "var(--series-1)", borderColor: "var(--series-1)", color: "#fff" }}
            >
              Criar conta
            </button>
          </div>
        </div>

        {status ? (
          <div className="mt-3">
            <Notice tone={status.tone}>{status.text}</Notice>
          </div>
        ) : null}
      </form>

      {usuarios.length ? (
        <ul className="space-y-2">
          {usuarios.map((usuario) => {
            const cliente = clientes.find((item) => item.id === usuario.clientId);
            return (
              <li key={usuario.user} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {usuario.user}
                      {!usuario.active ? (
                        <span className="ml-2 text-[11px]" style={{ color: "var(--warning)" }}>
                          desativada
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {cliente ? (
                        `vê ${cliente.name}`
                      ) : (
                        <span style={{ color: "var(--critical)" }}>
                          cliente “{usuario.clientId}” não existe mais
                        </span>
                      )}{" "}
                      · {formatDate(usuario.lastLoginAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="control text-xs"
                      value={usuario.clientId}
                      onChange={(event) =>
                        call("PUT", { user: usuario.user, clientId: event.target.value }, "Cliente atualizado.")
                      }
                    >
                      {clientes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>

                    <input
                      className="control w-40 text-xs"
                      type="password"
                      placeholder="nova senha"
                      value={trocaSenha[usuario.user] || ""}
                      onChange={(event) =>
                        setTrocaSenha((current) => ({ ...current, [usuario.user]: event.target.value }))
                      }
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="control text-xs"
                      disabled={saving || !(trocaSenha[usuario.user] || "").trim()}
                      onClick={async () => {
                        const ok = await call(
                          "PUT",
                          { user: usuario.user, password: trocaSenha[usuario.user] },
                          `Senha de "${usuario.user}" trocada.`,
                        );
                        if (ok) setTrocaSenha((current) => ({ ...current, [usuario.user]: "" }));
                      }}
                    >
                      Trocar senha
                    </button>

                    <button
                      type="button"
                      className="control text-xs"
                      disabled={saving}
                      onClick={() =>
                        call(
                          "PUT",
                          { user: usuario.user, active: !usuario.active },
                          usuario.active ? "Conta desativada." : "Conta reativada.",
                        )
                      }
                    >
                      {usuario.active ? "Desativar" : "Reativar"}
                    </button>

                    <button
                      type="button"
                      className="control text-xs"
                      style={{ color: "var(--critical)" }}
                      disabled={saving}
                      onClick={() => {
                        if (confirm(`Remover a conta "${usuario.user}"? O acesso para imediatamente.`)) {
                          call("DELETE", null, "Conta removida.", `?user=${encodeURIComponent(usuario.user)}`);
                        }
                      }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Nenhuma conta de cliente ainda. Crie uma acima e mande o usuário e a senha para o cliente.
        </p>
      )}

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Gravadas em <code>{arquivo}</code>, com a senha em hash e o arquivo restrito ao dono (600). Trocar a senha
        master não derruba estas contas, mas trocar o <code>SESSION_SECRET</code> encerra todas as sessões abertas.
      </p>
    </div>
  );
}
