"use client";

import { useEffect, useMemo, useState } from "react";
import { Field, Notice, SaveBar } from "./shared";

interface ReportBlock {
  id: string;
  type: string;
  title?: string;
  description?: string;
  hidden?: boolean;
  internal?: boolean;
  kpiIds?: string[];
  columns?: 3 | 4;
  size?: "lg" | "sm";
  text?: string;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  clientId: string | null;
  isDefault: boolean;
  blocks: ReportBlock[];
  updatedAt: string;
}

interface BlockType {
  type: string;
  label: string;
  description: string;
  configurable: string[];
}

const CUSTOM_TOKEN = "__custom__";

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 49);
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ReportsTab() {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [original, setOriginal] = useState("[]");
  const [blocos, setBlocos] = useState<BlockType[]>([]);
  const [indicadores, setIndicadores] = useState<{ id: string; label: string }[]>([]);
  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [arquivo, setArquivo] = useState("");
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<{ tone: "ok" | "erro" | "aviso"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const body = (await fetch("/api/admin/reports").then((r) => r.json())) as {
      templates: ReportTemplate[];
      blocos: BlockType[];
      indicadores: { id: string; label: string }[];
      clientes: { id: string; name: string }[];
      arquivo: string;
      salvo: boolean;
    };
    setTemplates(body.templates || []);
    setOriginal(JSON.stringify(body.templates || []));
    setBlocos(body.blocos || []);
    setIndicadores(body.indicadores || []);
    setClientes(body.clientes || []);
    setArquivo(body.arquivo || "");
    if (!body.salvo) {
      setStatus({
        tone: "aviso",
        text: "Este é o layout de fábrica. Salve para começar a editar — o relatório continua igual até você mudar algo.",
      });
    }
  }

  useEffect(() => {
    load().catch(() => setStatus({ tone: "erro", text: "Não foi possível carregar os relatórios." }));
  }, []);

  const dirty = useMemo(() => JSON.stringify(templates) !== original, [templates, original]);
  const template = templates[selected];

  function updateTemplate(patch: Partial<ReportTemplate>) {
    setTemplates((current) => current.map((item, i) => (i === selected ? { ...item, ...patch } : item)));
  }

  function updateBlock(index: number, patch: Partial<ReportBlock>) {
    if (!template) return;
    updateTemplate({
      blocks: template.blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    });
  }

  function moveBlock(index: number, direction: -1 | 1) {
    if (!template) return;
    const target = index + direction;
    if (target < 0 || target >= template.blocks.length) return;
    const blocks = [...template.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    updateTemplate({ blocks });
  }

  function addBlock(type: string) {
    if (!template) return;
    updateTemplate({ blocks: [...template.blocks, { id: uid(type), type }] });
  }

  function duplicateTemplate() {
    if (!template) return;
    const copy: ReportTemplate = {
      ...template,
      id: uid(slug(template.name) || "relatorio"),
      name: `${template.name} (cópia)`,
      isDefault: false,
      updatedAt: "",
      blocks: template.blocks.map((block) => ({ ...block, id: uid(block.type) })),
    };
    setTemplates((current) => [...current, copy]);
    setSelected(templates.length);
  }

  function newTemplate() {
    const novo: ReportTemplate = {
      id: uid("relatorio"),
      name: "Novo relatório",
      description: "",
      clientId: null,
      isDefault: false,
      updatedAt: "",
      blocks: [
        {
          id: uid("kpis"),
          type: "kpis",
          title: "Indicadores principais",
          kpiIds: ["spend", "crmLeads", "cpl", "won"],
          columns: 4,
          size: "lg",
        },
      ],
    };
    setTemplates((current) => [...current, novo]);
    setSelected(templates.length);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates }),
      });
      const body = (await response.json()) as { error?: string; total?: number };
      if (!response.ok) throw new Error(body.error || "Falha ao salvar.");
      await load();
      setStatus({ tone: "ok", text: `${body.total} relatório(s) salvo(s).` });
    } catch (error) {
      setStatus({ tone: "erro", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const blockLabel = (type: string) => blocos.find((item) => item.type === type)?.label || type;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {templates.length} relatório(s). Templates globais valem para todos os clientes; os do cliente ganham do
          global quando ambos são padrão.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="control" onClick={newTemplate}>
            + Novo
          </button>
          <button type="button" className="control" onClick={duplicateTemplate} disabled={!template}>
            Duplicar
          </button>
          <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => load()} />
        </div>
      </div>

      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}

      <div className="flex flex-wrap gap-1" style={{ borderBottom: "1px solid var(--border)" }}>
        {templates.map((item, index) => {
          const active = index === selected;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(index)}
              className="px-3 py-2 text-xs"
              style={{
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: active ? 600 : 400,
                borderBottom: `2px solid ${active ? "var(--series-1)" : "transparent"}`,
                marginBottom: "-1px",
              }}
            >
              {item.name}
              {item.isDefault ? " ★" : ""}
              {item.clientId ? ` · ${item.clientId}` : ""}
            </button>
          );
        })}
      </div>

      {!template ? (
        <p className="card p-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
          Nenhum relatório. Crie um para começar.
        </p>
      ) : (
        <>
          <section className="card p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome">
                <input
                  className="control w-full"
                  value={template.name}
                  onChange={(event) => updateTemplate({ name: event.target.value })}
                />
              </Field>
              <Field label="Identificador">
                <input
                  className="control w-full"
                  value={template.id}
                  onChange={(event) => updateTemplate({ id: slug(event.target.value) })}
                />
              </Field>
              <Field
                label="Escopo"
                help="Global vale para todos. Do cliente aparece só para ele — é o “salvar como template do cliente”."
              >
                <select
                  className="control w-full"
                  value={template.clientId || "__global__"}
                  onChange={(event) =>
                    updateTemplate({ clientId: event.target.value === "__global__" ? null : event.target.value })
                  }
                >
                  <option value="__global__">Global (todos os clientes)</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Padrão do escopo" help="Abre automaticamente. Só um por escopo.">
                <select
                  className="control w-full"
                  value={template.isDefault ? "sim" : "nao"}
                  onChange={(event) => updateTemplate({ isDefault: event.target.value === "sim" })}
                >
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Descrição">
                  <input
                    className="control w-full"
                    value={template.description}
                    onChange={(event) => updateTemplate({ description: event.target.value })}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                className="control text-xs"
                href={`/?client=${template.clientId || "__all__"}&template=${template.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver no relatório ↗
              </a>
              <button
                type="button"
                className="control text-xs"
                style={{ color: "var(--critical)" }}
                onClick={() => {
                  if (confirm(`Remover o relatório "${template.name}"?`)) {
                    setTemplates((current) => current.filter((_, i) => i !== selected));
                    setSelected(0);
                  }
                }}
              >
                Remover relatório
              </button>
            </div>
          </section>

          <section className="card p-4">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Blocos ({template.blocks.length})
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              A ordem aqui é a ordem na tela. Gráficos em sequência dividem a linha automaticamente.
            </p>

            <ul className="mt-3 space-y-2">
              {template.blocks.map((block, index) => (
                <li key={block.id} className="rounded-lg p-3" style={{ border: "1px solid var(--border)" }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                      {index + 1}. {blockLabel(block.type)}
                      {block.hidden ? (
                        <span className="ml-2 font-normal" style={{ color: "var(--text-muted)" }}>
                          oculto
                        </span>
                      ) : null}
                      {block.internal ? (
                        <span className="ml-2 font-normal" style={{ color: "var(--warning)" }}>
                          só a agência
                        </span>
                      ) : null}
                    </span>
                    <div className="flex items-center gap-1">
                      <button type="button" className="control px-2 py-1 text-xs" onClick={() => moveBlock(index, -1)}>
                        ↑
                      </button>
                      <button type="button" className="control px-2 py-1 text-xs" onClick={() => moveBlock(index, 1)}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="control px-2 py-1 text-xs"
                        onClick={() => updateBlock(index, { hidden: !block.hidden })}
                      >
                        {block.hidden ? "Mostrar" : "Ocultar"}
                      </button>
                      <button
                        type="button"
                        className="control px-2 py-1 text-xs"
                        title="Bloco visível para a agência e escondido das contas de cliente."
                        onClick={() => updateBlock(index, { internal: !block.internal })}
                      >
                        {block.internal ? "Liberar ao cliente" : "Só a agência"}
                      </button>
                      <button
                        type="button"
                        className="control px-2 py-1 text-xs"
                        style={{ color: "var(--critical)" }}
                        onClick={() => updateTemplate({ blocks: template.blocks.filter((_, i) => i !== index) })}
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="Título" help="Vazio usa o título padrão do bloco.">
                      <input
                        className="control w-full"
                        value={block.title || ""}
                        onChange={(event) => updateBlock(index, { title: event.target.value })}
                      />
                    </Field>
                    <Field label="Descrição">
                      <input
                        className="control w-full"
                        value={block.description || ""}
                        onChange={(event) => updateBlock(index, { description: event.target.value })}
                      />
                    </Field>

                    {block.type === "text" ? (
                      <div className="md:col-span-2">
                        <Field label="Texto" help="Comentário da agência, contexto do período, próximos passos.">
                          <textarea
                            className="control w-full"
                            rows={4}
                            value={block.text || ""}
                            onChange={(event) => updateBlock(index, { text: event.target.value })}
                          />
                        </Field>
                      </div>
                    ) : null}

                    {block.type === "kpis" ? (
                      <>
                        <Field label="Colunas">
                          <select
                            className="control w-full"
                            value={String(block.columns || 4)}
                            onChange={(event) =>
                              updateBlock(index, { columns: Number(event.target.value) === 3 ? 3 : 4 })
                            }
                          >
                            <option value="4">4 colunas</option>
                            <option value="3">3 colunas</option>
                          </select>
                        </Field>
                        <Field label="Tamanho do card">
                          <select
                            className="control w-full"
                            value={block.size || "lg"}
                            onChange={(event) => updateBlock(index, { size: event.target.value as "lg" | "sm" })}
                          >
                            <option value="lg">Grande</option>
                            <option value="sm">Compacto</option>
                          </select>
                        </Field>
                        <div className="md:col-span-2">
                          <Field label="Indicadores" help="A ordem de seleção não importa; vale a ordem da lista.">
                            <div
                              className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg p-2"
                              style={{ border: "1px solid var(--border)" }}
                            >
                              <label className="flex items-center gap-1.5 text-xs">
                                <input
                                  type="checkbox"
                                  checked={(block.kpiIds || []).includes(CUSTOM_TOKEN)}
                                  onChange={(event) => {
                                    const current = block.kpiIds || [];
                                    updateBlock(index, {
                                      kpiIds: event.target.checked
                                        ? [...current, CUSTOM_TOKEN]
                                        : current.filter((id) => id !== CUSTOM_TOKEN),
                                    });
                                  }}
                                />
                                <span style={{ color: "var(--series-1)" }}>Todas as personalizadas</span>
                              </label>
                              {indicadores.map((indicador) => (
                                <label key={indicador.id} className="flex items-center gap-1.5 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={(block.kpiIds || []).includes(indicador.id)}
                                    onChange={(event) => {
                                      const current = block.kpiIds || [];
                                      updateBlock(index, {
                                        kpiIds: event.target.checked
                                          ? [...current, indicador.id]
                                          : current.filter((id) => id !== indicador.id),
                                      });
                                    }}
                                  />
                                  <span style={{ color: "var(--text-secondary)" }}>{indicador.label}</span>
                                </label>
                              ))}
                            </div>
                          </Field>
                        </div>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Adicionar bloco
              </p>
              <div className="flex flex-wrap gap-2">
                {blocos.map((bloco) => (
                  <button
                    key={bloco.type}
                    type="button"
                    className="control text-xs"
                    title={bloco.description}
                    onClick={() => addBlock(bloco.type)}
                  >
                    + {bloco.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <SaveBar dirty={dirty} saving={saving} onSave={save} onReset={() => load()} />
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Gravados em <code>{arquivo}</code>.
          </p>
        </>
      )}
    </div>
  );
}
