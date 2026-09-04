"use client";

import type { ReactNode } from "react";

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {help ? (
        <span className="mt-1 block text-[11px]" style={{ color: "var(--text-muted)" }}>
          {help}
        </span>
      ) : null}
    </label>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "erro" | "aviso"; children: ReactNode }) {
  const colors = { ok: "var(--good)", erro: "var(--critical)", aviso: "var(--warning)" };
  return (
    <p
      role="status"
      className="rounded-lg px-3 py-2 text-xs"
      style={{
        background: `color-mix(in srgb, ${colors[tone]} 12%, transparent)`,
        color: tone === "aviso" ? "var(--text-primary)" : colors[tone],
      }}
    >
      {children}
    </p>
  );
}

export function SaveBar({
  dirty,
  saving,
  onSave,
  onReset,
  label = "Salvar alterações",
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset?: () => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        className="control font-medium"
        style={{
          background: dirty ? "var(--series-1)" : "var(--surface-2)",
          borderColor: dirty ? "var(--series-1)" : "var(--border-strong)",
          color: dirty ? "#fff" : "var(--text-muted)",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Salvando…" : label}
      </button>
      {onReset && dirty ? (
        <button type="button" onClick={onReset} className="control">
          Descartar
        </button>
      ) : null}
      {dirty ? (
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          alterações não salvas
        </span>
      ) : null}
    </div>
  );
}

/** Lista separada por vírgula <-> array, usada nos campos de contas e funis. */
export function toList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function fromList(values: string[] | undefined): string {
  return (values || []).join(", ");
}
