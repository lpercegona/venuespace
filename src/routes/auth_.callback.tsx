import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrando — Venuespace" },
      { name: "description", content: "Concluindo o login no Venuespace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallback,
});

/** Destino salvo antes do login social (sempre um caminho interno). */
export const OAUTH_REDIRECT_KEY = "venuespace:oauth-redirect";

function safePath(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      const target = safePath(sessionStorage.getItem(OAUTH_REDIRECT_KEY)) ?? "/app";
      sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
      navigate({ to: target, replace: true });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) go();
    });

    // A sessão pode já estar hidratada quando o componente monta.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });

    // Sem sessão após alguns segundos: volta para a tela de login.
    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        navigate({ to: "/auth", replace: true });
      }
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Concluindo seu login…</p>
    </div>
  );
}
