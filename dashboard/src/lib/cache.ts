/**
 * Cache em memória com TTL. As APIs de Ads e do CRM têm rate limit e latência alta;
 * sem cache, cada troca de filtro no dashboard viraria uma rodada de chamadas externas.
 */
interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS || 300);

export function cacheTtlSeconds(): number {
  return Number.isFinite(DEFAULT_TTL_SECONDS) && DEFAULT_TTL_SECONDS > 0 ? DEFAULT_TTL_SECONDS : 300;
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlSeconds = cacheTtlSeconds()): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheClear(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Busca com cache e deduplicação: chamadas concorrentes com a mesma chave
 * compartilham uma única requisição externa.
 */
export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;

  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const promise = loader()
    .then((value) => {
      cacheSet(key, value, ttlSeconds);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}
