// Cache em memória (por instância) para leituras públicas — reduz latência das
// páginas públicas evitando repetir consultas e assinaturas de URL a cada bloco.

type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): T {
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

/** Executa `fn` no máximo uma vez por chave dentro do TTL (dedup de concorrência). */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = (async () => {
    try {
      const value = await fn();
      cacheSet(key, value, ttlMs);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export const TTL_SHORT = 30_000;
export const TTL_MEDIUM = 5 * 60_000;
/** URLs assinadas expiram em 1h; guardamos por 45min com margem de segurança. */
export const TTL_SIGNED = 45 * 60_000;
