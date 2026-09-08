"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OrganicQueryRow } from "@/lib/types";
import { formatDayLabel, formatDecimal, formatNumber, formatPercent } from "@/lib/format";
import { ChartCard, DataTable } from "../ui";
import { KpiGrid } from "../KpiGrid";
import { ChartTooltip } from "../charts/Tooltip";
import { AXIS_PROPS, CHART_HEIGHT, GRID_PROPS, ORDINAL_BLUE, SERIES } from "../charts/theme";
import { useOrganic } from "./useOrganic";

/**
 * Blocos de tráfego orgânico.
 *
 * Cada bloco só aparece quando a sua fonte trouxe dado: um relatório com
 * "0 seguidores" para quem não conectou o Instagram é pior que um relatório
 * sem a seção. Quando falta a fonte, o bloco explica o que conectar.
 */

function Loading() {
  return (
    <div className="card p-4">
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Carregando tráfego orgânico…
      </p>
    </div>
  );
}

function Falha({ mensagem }: { mensagem: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs" style={{ color: "var(--critical)" }}>
        {mensagem}
      </p>
    </div>
  );
}

/** O que dizer quando a fonte não está conectada — sem inventar zeros. */
function FonteAusente({ titulo, detalhe }: { titulo: string; detalhe: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {titulo}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        {detalhe}
      </p>
    </div>
  );
}

export function OrganicKpis({ query, demoLabel }: { query: string; demoLabel?: boolean }) {
  const { data, loading, error } = useOrganic(query);

  if (loading) return <Loading />;
  if (error) return <Falha mensagem={error} />;
  if (!data || !data.kpis.length) {
    return (
      <FonteAusente
        titulo="Sem fonte de orgânico conectada"
        detalhe="Cadastre as contas do cliente em Administração › Clientes e ative as fontes em Administração › Orgânico."
      />
    );
  }

  return (
    <div className="space-y-2">
      {demoLabel && data.meta.demo ? (
        <p className="text-[11px]" style={{ color: "var(--warning)" }}>
          Números de demonstração — nenhuma conta de orgânico conectada ainda.
        </p>
      ) : null}
      <KpiGrid kpis={data.kpis} currency="BRL" size="sm" columns={4} />
    </div>
  );
}

export function OrganicTraffic({ query }: { query: string }) {
  const { data, loading, error } = useOrganic(query);

  if (loading) return <Loading />;
  if (error) return <Falha mensagem={error} />;

  const series = data?.series || [];
  const temGa4 = series.some((point) => point.sessions > 0);

  if (!temGa4) {
    return (
      <FonteAusente
        titulo="Google Analytics 4 não conectado"
        detalhe="As sessões e conversões do site vêm do GA4. Conecte a propriedade na Windsor e ative a fonte em Administração › Orgânico."
      />
    );
  }

  return (
    <ChartCard
      title="Sessões e usuários por dia"
      description="Tráfego do site registrado pelo GA4, somando todos os canais."
      legend={[
        { label: "Sessões", color: SERIES.meta },
        { label: "Usuários", color: SERIES.leads },
      ]}
      table={{
        columns: ["Dia", "Sessões", "Usuários", "Páginas", "Conversões"],
        rows: series.map((point) => [
          formatDayLabel(point.date),
          formatNumber(point.sessions),
          formatNumber(point.users),
          formatNumber(point.pageViews),
          formatNumber(point.conversions),
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <ComposedChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="organic-sessions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tickFormatter={formatDayLabel} minTickGap={24} {...AXIS_PROPS} />
          <YAxis allowDecimals={false} width={44} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            content={<ChartTooltip formatter={(value) => formatNumber(value)} labelFormatter={formatDayLabel} />}
          />
          <Area
            type="monotone"
            dataKey="sessions"
            name="Sessões"
            stroke={SERIES.meta}
            strokeWidth={2}
            fill="url(#organic-sessions)"
          />
          <Line type="monotone" dataKey="users" name="Usuários" stroke={SERIES.leads} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function OrganicChannels({ query }: { query: string }) {
  const { data, loading, error } = useOrganic(query);

  if (loading) return <Loading />;
  if (error) return <Falha mensagem={error} />;

  const channels = data?.channels || [];
  if (!channels.length) {
    return (
      <FonteAusente
        titulo="Sem quebra por canal"
        detalhe="A separação por canal (busca, direto, social, referência) vem do GA4."
      />
    );
  }

  return (
    <ChartCard
      title="Sessões por canal"
      description="De onde vem o tráfego do site, pela classificação do GA4."
      table={{
        columns: ["Canal", "Sessões", "Participação", "Engajamento", "Conversões", "Taxa de conversão"],
        rows: channels.map((row) => [
          row.channel,
          formatNumber(row.sessions),
          row.share === null ? "—" : formatPercent(row.share),
          row.engagementRate === null ? "—" : formatPercent(row.engagementRate),
          formatNumber(row.conversions),
          row.conversionRate === null ? "—" : formatPercent(row.conversionRate),
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height={Math.max(CHART_HEIGHT, channels.length * 34 + 20)}>
        <BarChart data={channels} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
          <XAxis type="number" tickFormatter={(value) => formatNumber(value, true)} {...AXIS_PROPS} />
          <YAxis type="category" dataKey="channel" width={130} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={<ChartTooltip formatter={(value) => formatNumber(value)} />}
          />
          <Bar dataKey="sessions" name="Sessões" radius={[0, 4, 4, 0]}>
            {channels.map((row, index) => (
              <Cell key={row.channel} fill={ORDINAL_BLUE[Math.min(index, ORDINAL_BLUE.length - 1)]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function SearchTable({ titulo, descricao, rows }: { titulo: string; descricao: string; rows: OrganicQueryRow[] }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {titulo}
      </h3>
      <p className="mb-3 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
        {descricao}
      </p>
      <DataTable
        columns={["Termo", "Cliques", "Impressões", "CTR", "Posição"]}
        rows={rows.map((row) => [
          row.query,
          formatNumber(row.clicks),
          formatNumber(row.impressions),
          row.ctr === null ? "—" : formatPercent(row.ctr),
          row.position === null ? "—" : formatDecimal(row.position, 1),
        ])}
      />
    </div>
  );
}

export function OrganicSearch({ query }: { query: string }) {
  const { data, loading, error } = useOrganic(query);

  if (loading) return <Loading />;
  if (error) return <Falha mensagem={error} />;

  const series = data?.series || [];
  const temBusca = series.some((point) => point.searchImpressions > 0);

  if (!temBusca) {
    return (
      <FonteAusente
        titulo="Google Search Console não conectado"
        detalhe="Cliques, impressões, CTR e posição média na busca vêm do Search Console."
      />
    );
  }

  return (
    <div className="grid gap-4">
      <ChartCard
        title="Busca orgânica por dia"
        description="Cliques e impressões no Google, pelo Search Console."
        legend={[
          { label: "Cliques", color: SERIES.leads },
          { label: "Impressões", color: SERIES.google },
        ]}
        table={{
          columns: ["Dia", "Cliques", "Impressões"],
          rows: series.map((point) => [
            formatDayLabel(point.date),
            formatNumber(point.searchClicks),
            formatNumber(point.searchImpressions),
          ]),
        }}
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" tickFormatter={formatDayLabel} minTickGap={24} {...AXIS_PROPS} />
            {/* Cliques e impressões vivem em ordens de grandeza diferentes:
                num eixo só, a linha de cliques ficaria colada no zero. */}
            <YAxis yAxisId="cliques" allowDecimals={false} width={44} {...AXIS_PROPS} />
            <YAxis
              yAxisId="impressoes"
              orientation="right"
              width={48}
              tickFormatter={(value) => formatNumber(value, true)}
              {...AXIS_PROPS}
            />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
              content={<ChartTooltip formatter={(value) => formatNumber(value)} labelFormatter={formatDayLabel} />}
            />
            <Line
              yAxisId="cliques"
              type="monotone"
              dataKey="searchClicks"
              name="Cliques"
              stroke={SERIES.leads}
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="impressoes"
              type="monotone"
              dataKey="searchImpressions"
              name="Impressões"
              stroke={SERIES.google}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SearchTable
          titulo="Termos que mais trazem cliques"
          descricao="O que as pessoas digitaram antes de chegar ao site."
          rows={data?.queries || []}
        />
        <SearchTable
          titulo="Páginas mais buscadas"
          descricao="Onde a busca orgânica está entregando o tráfego."
          rows={data?.pages || []}
        />
      </div>
    </div>
  );
}

export function OrganicSocial({ query }: { query: string }) {
  const { data, loading, error } = useOrganic(query);

  if (loading) return <Loading />;
  if (error) return <Falha mensagem={error} />;

  const social = data?.social || [];
  if (!social.length) {
    return (
      <FonteAusente
        titulo="Nenhuma rede social conectada"
        detalhe="Seguidores, alcance e engajamento vêm das contas de Instagram e Facebook conectadas na Windsor."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {social.map((rede) => (
        <div key={rede.source} className="card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {rede.label}
            </h3>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {formatNumber(rede.posts)} publicação(ões) no período
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-3">
            <Metrica
              rotulo="Seguidores"
              valor={formatNumber(rede.followers)}
              nota={
                rede.followersDelta === null
                  ? "sem base anterior"
                  : `${rede.followersDelta >= 0 ? "+" : ""}${formatNumber(rede.followersDelta)} no período`
              }
            />
            <Metrica rotulo="Alcance" valor={formatNumber(rede.reach)} />
            <Metrica rotulo="Impressões" valor={formatNumber(rede.impressions)} />
            <Metrica
              rotulo="Engajamento"
              valor={formatNumber(rede.engagement)}
              nota={rede.engagementRate === null ? undefined : `${formatPercent(rede.engagementRate)} do alcance`}
            />
          </dl>
        </div>
      ))}
    </div>
  );
}

function Metrica({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div>
      <dt className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        {rotulo}
      </dt>
      <dd className="tnum text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        {valor}
      </dd>
      {nota ? (
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {nota}
        </p>
      ) : null}
    </div>
  );
}

/** Situação de cada fonte — útil enquanto as contas ainda estão sendo conectadas. */
export function OrganicStatus({ query }: { query: string }) {
  const { data, loading, error } = useOrganic(query);

  if (loading) return <Loading />;
  if (error) return <Falha mensagem={error} />;
  if (!data) return null;

  return (
    <div className="card p-4">
      <DataTable
        columns={["Fonte", "Conector", "Ativa", "Contas", "Linhas", "Erro"]}
        rows={data.status.map((item) => [
          item.label,
          item.connector,
          item.enabled ? "sim" : "não",
          formatNumber(item.accounts),
          formatNumber(item.rows),
          item.error || "—",
        ])}
      />
      {data.meta.warnings.length ? (
        <ul className="mt-3 space-y-1">
          {data.meta.warnings.map((warning) => (
            <li key={warning} className="text-[11px]" style={{ color: "var(--warning)" }}>
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
