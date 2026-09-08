"use client";

import { useEffect, useState } from "react";
import type { OrganicPayload } from "@/lib/types";

/**
 * Carrega o payload de orgânico uma vez por consulta, mesmo com vários blocos
 * na tela.
 *
 * O relatório pode ter cinco blocos de orgânico ao mesmo tempo; sem isto,
 * seriam cinco chamadas idênticas à API a cada troca de período. O cache guarda
 * a promessa em andamento, então quem chegar no meio do caminho espera a mesma.
 */

const cache = new Map<string, Promise<OrganicPayload>>();

export function organicCacheClear(): void {
  cache.clear();
}

function load(query: string): Promise<OrganicPayload> {
  const existing = cache.get(query);
  if (existing) return existing;

  const request = fetch(`/api/organic?${query}`, { cache: "no-store" })
    .then(async (response) => {
      const body = (await response.json()) as OrganicPayload & { error?: string };
      if (!response.ok) throw new Error(body.error || "Falha ao carregar o tráfego orgânico.");
      return body;
    })
    .catch((error: Error) => {
      // Erro não fica cacheado: a próxima tentativa precisa poder dar certo.
      cache.delete(query);
      throw error;
    });

  cache.set(query, request);
  return request;
}

export interface OrganicState {
  data: OrganicPayload | null;
  loading: boolean;
  error: string;
}

export function useOrganic(query: string): OrganicState {
  const [state, setState] = useState<OrganicState>({ data: null, loading: true, error: "" });

  useEffect(() => {
    let cancelado = false;
    setState({ data: null, loading: true, error: "" });

    load(query)
      .then((data) => {
        if (!cancelado) setState({ data, loading: false, error: "" });
      })
      .catch((error: Error) => {
        if (!cancelado) setState({ data: null, loading: false, error: error.message });
      });

    return () => {
      cancelado = true;
    };
  }, [query]);

  return state;
}
