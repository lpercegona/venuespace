import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Middleware de autenticação do projeto (substitui o uso direto de
 * `requireSupabaseAuth` gerado em `@/integrations/supabase/auth-middleware`).
 *
 * Motivo: o middleware gerado valida o token com `supabase.auth.getClaims()`,
 * que — com chaves assimétricas (ES256) — verifica a assinatura localmente via
 * `jose`, com tolerância de relógio ZERO. Se o relógio do runtime estiver
 * alguns segundos atrás do emissor do token, o `iat` fica "no futuro" e a
 * validação falha com "JWT issued at future".
 *
 * Aqui a validação é feita contra o servidor de auth (`getUser(token)`), que é
 * a autoridade e é imune a desvio de relógio local. O `exp` continua sendo
 * respeitado pelo servidor de auth; apenas `iat`/`nbf` ganham tolerância.
 */

const CLOCK_TOLERANCE_SECONDS = 60;
/** TTL curto de cache por token, para não pagar 1 requisição HTTP por chamada. */
const VALIDATION_CACHE_TTL_MS = 30_000;

type Claims = Record<string, unknown> & { sub?: string };

const validationCache = new Map<string, { userId: string; claims: Claims; expiresAt: number }>();

function decodePayload(token: string): Claims | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Claims;
  } catch {
    return null;
  }
}

function logClockSkew(claims: Claims | null, reason: string): void {
  if (!claims) return;
  const iat = typeof claims["iat"] === "number" ? (claims["iat"] as number) : null;
  const exp = typeof claims["exp"] === "number" ? (claims["exp"] as number) : null;
  const now = Math.floor(Date.now() / 1000);
  console.warn(
    `[auth] falha ao validar token (${reason}) — now=${now} iat=${iat ?? "?"} exp=${exp ?? "?"} ` +
      `skew=${iat != null ? now - iat : "?"}s (negativo = relógio do servidor atrasado)`,
  );
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    // Chaves novas do Supabase são opacas, não são bearer JWT.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function pruneCache(now: number): void {
  if (validationCache.size < 200) return;
  for (const [key, value] of validationCache) {
    if (value.expiresAt <= now) validationCache.delete(key);
  }
}

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: Only Bearer tokens are supported");

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) throw new Error("Unauthorized: Invalid token");

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const now = Date.now();
  const cached = validationCache.get(token);
  if (cached && cached.expiresAt > now) {
    return next({ context: { supabase, userId: cached.userId, claims: cached.claims } });
  }

  const payload = decodePayload(token);

  // `exp` é checado localmente com tolerância só para não gastar requisição em
  // token claramente expirado; `iat`/`nbf` NÃO derrubam a validação.
  const nowSeconds = Math.floor(now / 1000);
  const exp = typeof payload?.["exp"] === "number" ? (payload["exp"] as number) : null;
  if (exp != null && nowSeconds - CLOCK_TOLERANCE_SECONDS > exp) {
    logClockSkew(payload, "token expirado");
    throw new Error("Unauthorized: Token expired");
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) {
    logClockSkew(payload, error?.message ?? "usuário não encontrado");
    throw new Error("Unauthorized: Invalid token");
  }

  const claims: Claims = payload ?? { sub: data.user.id };
  claims.sub = data.user.id;

  pruneCache(now);
  validationCache.set(token, {
    userId: data.user.id,
    claims,
    expiresAt: now + VALIDATION_CACHE_TTL_MS,
  });

  return next({ context: { supabase, userId: data.user.id, claims } });
});

/** Alias para manter o mesmo nome usado nas server functions existentes. */
export const requireSupabaseAuth = requireAuth;
