"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AdCreative } from "@/lib/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { DataTable } from "./ui";
import { SERIES } from "./charts/theme";

type SortKey = "spend" | "cpl" | "ctr" | "clicks";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "spend", label: "Maior investimento" },
  { key: "cpl", label: "Menor CPL" },
  { key: "ctr", label: "Maior CTR" },
  { key: "clicks", label: "Mais cliques" },
];

function Thumbnail({ creative }: { creative: AdCreative }) {
  const [failed, setFailed] = useState(false);
  const label = creative.channel === "meta" ? "Meta" : "Google";

  // As URLs de miniatura do Meta expiram; quando quebram, o card continua
  // legível com um bloco neutro em vez de um ícone de imagem quebrada.
  if (!creative.thumbnailUrl || failed) {
    return (
      <div
        className="flex aspect-square w-full items-center justify-center rounded-lg text-xs"
        style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
      >
        sem miniatura
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={creative.thumbnailUrl}
      alt={`Criativo do anúncio ${creative.adName} (${label})`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="aspect-square w-full rounded-lg object-cover"
      style={{ background: "var(--surface-2)" }}
    />
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </dt>
      <dd className="tnum text-xs font-medium" style={{ color: "var(--text-primary)" }}>
        {value}
      </dd>
    </div>
  );
}

export function CreativesGallery({
  clientId,
  query,
  currency,
}: {
  clientId: string;
  /** Query string do período, para a busca casar com o resto do relatório. */
  query: string;
  currency: string;
}) {
  const [creatives, setCreatives] = useState<AdCreative[] | null>(null);
  const [supported, setSupported] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("spend");
  const [channel, setChannel] = useState<"all" | "meta" | "google">("all");
  const [showTable, setShowTable] = useState(false);
  const [visible, setVisible] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  // Consulta pesada: só dispara quando a seção entra na tela.
  useEffect(() => {
    const node = anchor.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && setVisible(true)),
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/creatives?${query}`, { cache: "no-store" });
      const body = (await response.json()) as {
        creatives?: AdCreative[];
        suportado?: boolean;
        warnings?: string[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Falha ao carregar os criativos.");
      setCreatives(body.creatives || []);
      setSupported(body.suportado !== false);
      setWarnings(body.warnings || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const rows = useMemo(() => {
    if (!creatives) return [];
    const filtered = creatives.filter((item) => (channel === "all" ? true : item.channel === channel));
    return [...filtered].sort((a, b) => {
      if (sort === "cpl") {
        // Anúncio sem lead não pode liderar um ranking de menor CPL.
        const left = a.cpl ?? Number.POSITIVE_INFINITY;
        const right = b.cpl ?? Number.POSITIVE_INFINITY;
        return left - right;
      }
      if (sort === "ctr") return (b.ctr ?? 0) - (a.ctr ?? 0);
      if (sort === "clicks") return b.clicks - a.clicks;
      return b.spend - a.spend;
    });
  }, [creatives, channel, sort]);

  if (!supported) {
    return (
      <div ref={anchor} className="card p-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        A fonte de mídia configurada não expõe dados por anúncio. Com o Windsor.ai, esta seção mostra a miniatura de cada
        criativo e o link para o anúncio.
      </div>
    );
  }

  return (
    <div ref={anchor}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={channel}
          onChange={(event) => setChannel(event.target.value as typeof channel)}
          aria-label="Filtrar criativos por canal"
          className="control"
        >
          <option value="all">Todos os canais</option>
          <option value="meta">Meta Ads</option>
          <option value="google">Google Ads</option>
        </select>

        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          aria-label="Ordenar criativos"
          className="control"
        >
          {SORTS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>

        <button type="button" className="control no-print" onClick={() => setShowTable((value) => !value)}>
          {showTable ? "Ver miniaturas" : "Ver dados"}
        </button>

        {creatives ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {rows.length} anúncio(s)
          </span>
        ) : null}
      </div>

      {warnings.length ? (
        <ul className="card mb-3 list-inside list-disc space-y-1 p-3 text-xs" style={{ color: "var(--text-secondary)" }}>
          {warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="card p-4 text-xs" role="alert" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      ) : null}

      {loading && !creatives ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="card h-[320px] animate-pulse" />
          ))}
        </div>
      ) : null}

      {creatives && !rows.length && !loading ? (
        <p className="card p-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
          Nenhum anúncio com veiculação no período.
        </p>
      ) : null}

      {rows.length && showTable ? (
        <div className="card p-4">
          <DataTable
            columns={["Anúncio", "Canal", "Campanha", "Investimento", "Cliques", "CTR", "Conversões", "CPL"]}
            rows={rows.map((item) => [
              item.adName,
              item.channel === "meta" ? "Meta Ads" : "Google Ads",
              item.campaign,
              formatCurrency(item.spend, currency),
              formatNumber(item.clicks),
              item.ctr === null ? "—" : formatPercent(item.ctr),
              formatNumber(item.platformLeads),
              item.cpl === null ? "—" : formatCurrency(item.cpl, currency),
            ])}
          />
        </div>
      ) : null}

      {rows.length && !showTable ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((item) => {
            const link = item.permalinkUrl || item.finalUrl;
            return (
              <li key={item.key} className="card flex flex-col p-3">
                <Thumbnail creative={item} />

                <div className="mt-3 flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-1 h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ background: item.channel === "meta" ? SERIES.meta : SERIES.google }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }} title={item.adName}>
                      {item.adName}
                    </p>
                    <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }} title={item.campaign}>
                      {item.campaign}
                    </p>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2">
                  <Metric label="Investimento" value={formatCurrency(item.spend, currency, true)} />
                  <Metric label="CPL" value={item.cpl === null ? "—" : formatCurrency(item.cpl, currency)} />
                  <Metric label="CTR" value={item.ctr === null ? "—" : formatPercent(item.ctr)} />
                </dl>

                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 text-[11px]"
                    style={{ color: "var(--series-1)" }}
                  >
                    {item.permalinkUrl ? "Ver publicação ↗" : "Ver página de destino ↗"}
                  </a>
                ) : (
                  <span className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    sem link disponível
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
