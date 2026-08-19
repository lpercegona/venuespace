import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

/** Erros que não indicam sessão inválida: relógio fora de sincronia ou rede. */
export function isTransientAuthError(error: { message?: string; status?: number } | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  if (
    msg.includes("issued at future") ||
    msg.includes("token used before issued") ||
    msg.includes("jwtclaimvalidationfailed") ||
    msg.includes("before nbf") ||
    msg.includes("clock") ||
    msg.includes("not yet valid")
  ) return true;
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout")) return true;
  const status = error.status ?? 0;
  return status === 0 || status >= 500;
}



export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    // Revalida a sessão contra o servidor de auth. Erros transitórios
    // (relógio fora de sincronia — "JWT issued at future" — ou rede) não podem
    // derrubar o usuário: tentamos renovar o token uma vez antes de decidir.
    (async () => {
      let { data, error } = await supabase.auth.getUser();
      if (error && isTransientAuthError(error)) {
        console.warn("[auth] erro transitório ao validar sessão, renovando token", error.message);
        await supabase.auth.refreshSession().catch(() => undefined);
        ({ data, error } = await supabase.auth.getUser());
      }
      if (error || !data?.user) {
        if (error && isTransientAuthError(error)) {
          // Mantém a sessão local; a próxima chamada tenta novamente.
          const { data: s } = await supabase.auth.getSession();
          setSession(s.session);
          setUser(s.session?.user ?? null);
          setLoading(false);
          return;
        }
        try { await supabase.auth.signOut({ scope: "local" }); } catch { /* ignore */ }
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      const { data: s } = await supabase.auth.getSession();
      setSession(s.session);
      setUser(s.session?.user ?? null);
      setLoading(false);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);


  return { session, user, loading };
}
