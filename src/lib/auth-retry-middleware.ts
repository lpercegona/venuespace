import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

function looksLikeTokenError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  return (
    msg.includes("unauthorized") ||
    msg.includes("invalid token") ||
    msg.includes("token expired") ||
    msg.includes("issued at future") ||
    msg.includes("token used before issued") ||
    msg.includes("jwtclaimvalidationfailed") ||
    msg.includes("before nbf") ||
    msg.includes("not yet valid") ||
    msg.includes("jwt")
  );
}


/**
 * Retry único e silencioso: quando uma server function falha por token inválido
 * (inclui "JWT issued at future" por relógio fora de sincronia), renova a sessão
 * e repete a chamada uma vez antes de propagar o erro.
 */
export const retryOnTokenError = createMiddleware({ type: "function" }).client(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (!looksLikeTokenError(error)) throw error;
    const { data, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !data.session) throw error;
    return await next({ headers: { Authorization: `Bearer ${data.session.access_token}` } });
  }
});
