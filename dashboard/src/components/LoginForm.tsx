"use client";

import { useState } from "react";

export function LoginForm({ mode, defaultUser }: { mode: "login" | "setup"; defaultUser: string }) {
  const [user, setUser] = useState(defaultUser);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSetup = mode === "setup";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (isSetup && password !== confirmation) {
      setError("As senhas não conferem.");
      return;
    }
    if (isSetup && password.length < 10) {
      setError("A senha master precisa ter pelo menos 10 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(isSetup ? "/api/auth/setup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Não foi possível entrar.");
      }
      window.location.href = isSetup ? "/admin" : "/";
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card w-full max-w-sm p-6">
      <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        {isSetup ? "Definir credenciais master" : "Dashboard de Marketing"}
      </h1>
      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        {isSetup
          ? "Primeiro acesso: escolha o usuário e a senha que vão administrar o painel."
          : "Entre para ver os relatórios."}
      </p>

      <label className="mt-5 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        Usuário
        <input
          className="control mt-1 w-full"
          value={user}
          onChange={(event) => setUser(event.target.value)}
          autoComplete="username"
          required
        />
      </label>

      <label className="mt-3 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        Senha
        <input
          className="control mt-1 w-full"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={isSetup ? "new-password" : "current-password"}
          required
        />
      </label>

      {isSetup ? (
        <label className="mt-3 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Repita a senha
          <input
            className="control mt-1 w-full"
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
      ) : null}

      {error ? (
        <p className="mt-3 text-xs" role="alert" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="control mt-5 w-full font-medium"
        style={{ background: "var(--series-1)", borderColor: "var(--series-1)", color: "#fff", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? "Entrando…" : isSetup ? "Criar credenciais e entrar" : "Entrar"}
      </button>
    </form>
  );
}
