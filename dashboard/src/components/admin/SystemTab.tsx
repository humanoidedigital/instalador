"use client";

import { useCallback, useEffect, useState } from "react";
import { Notice } from "./shared";

interface SystemInfo {
  usuarioMaster: string;
  processo: { uptimeSegundos: number; node: string; memoriaMb: number; cacheSegundos: number };
  arquivos: { clientes: string; cofre: string };
  fontes: { midia: { rotulo: string; demo: boolean }; crm: { rotulo: string; demo: boolean } };
  clientes: { total: number; comCrm: number };
  alertas: string[];
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)} d ${hours % 24} h`;
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
      <dt className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {label}
      </dt>
      <dd className="tnum text-right text-xs font-medium" style={{ color: "var(--text-primary)" }}>
        {value}
      </dd>
    </div>
  );
}

export function SystemTab() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const body = (await fetch("/api/admin/system").then((r) => r.json())) as SystemInfo;
    setInfo(body);
  }, []);

  useEffect(() => {
    load().catch(() => setStatus("Não foi possível ler o estado do sistema."));
  }, [load]);

  async function clearCache() {
    setWorking(true);
    try {
      await fetch("/api/admin/system", { method: "POST" });
      setStatus("Cache limpo. A próxima consulta vai buscar tudo de novo nas APIs.");
      await load();
    } finally {
      setWorking(false);
    }
  }

  if (!info) {
    return <div className="card h-40 animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      {info.alertas.length ? (
        <div className="space-y-2">
          {info.alertas.map((alerta, index) => (
            <Notice key={index} tone="aviso">
              {alerta}
            </Notice>
          ))}
        </div>
      ) : (
        <Notice tone="ok">Nenhum alerta: fontes conectadas e clientes com credencial de CRM.</Notice>
      )}

      {status ? <Notice tone="ok">{status}</Notice> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <section className="card p-4">
          <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Fontes de dados
          </h3>
          <dl>
            <Row label="Mídia paga" value={`${info.fontes.midia.rotulo}${info.fontes.midia.demo ? " (demonstração)" : ""}`} />
            <Row label="CRM" value={`${info.fontes.crm.rotulo}${info.fontes.crm.demo ? " (demonstração)" : ""}`} />
            <Row label="Clientes cadastrados" value={String(info.clientes.total)} />
            <Row label="Clientes com CRM conectado" value={`${info.clientes.comCrm} de ${info.clientes.total}`} />
          </dl>
        </section>

        <section className="card p-4">
          <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Processo
          </h3>
          <dl>
            <Row label="No ar há" value={formatUptime(info.processo.uptimeSegundos)} />
            <Row label="Memória" value={`${info.processo.memoriaMb} MB`} />
            <Row label="Node" value={info.processo.node} />
            <Row label="Cache das APIs" value={`${info.processo.cacheSegundos}s`} />
          </dl>
          <button type="button" onClick={clearCache} disabled={working} className="control mt-3 text-xs">
            {working ? "Limpando…" : "Limpar cache agora"}
          </button>
        </section>
      </div>

      <section className="card p-4">
        <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Arquivos no servidor
        </h3>
        <dl>
          <Row label="Clientes" value={info.arquivos.clientes} />
          <Row label="Cofre de credenciais" value={info.arquivos.cofre} />
        </dl>
        <p className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
          Faça backup destes dois arquivos: juntos, eles são toda a configuração do painel.
        </p>
      </section>
    </div>
  );
}
