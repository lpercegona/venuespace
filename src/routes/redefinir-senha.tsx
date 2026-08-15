import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicHeader } from "@/components/venue/public-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Venuespace" },
      { name: "description", content: "Defina uma nova senha para sua conta Venuespace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  /** null = ainda verificando o link de recuperação. */
  const [ready, setReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      setReady(ok);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) finish(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(true);
    });

    // O link pode estar expirado ou já utilizado: nesse caso nenhuma sessão chega.
    const timeout = setTimeout(() => finish(false), 6000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return toast.error("As senhas não conferem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada com sucesso.");
    navigate({ to: "/app", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showAuthActions={false} />
      <main className="flex items-center justify-center px-4 py-14 sm:px-6">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-xl">Redefinir senha</CardTitle>
              <CardDescription>Escolha uma nova senha para acessar sua conta.</CardDescription>
            </CardHeader>
            <CardContent>
              {ready === null ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : ready === false ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Este link de recuperação é inválido ou já expirou. Solicite um novo link na tela de acesso.
                  </p>
                  <Button asChild className="h-11 w-full">
                    <Link to="/auth">Pedir novo link</Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-pass">Nova senha</Label>
                    <Input
                      id="new-pass"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-pass-confirm">Confirmar nova senha</Label>
                    <Input
                      id="new-pass-confirm"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="h-11 w-full" disabled={loading || password.length < 8}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
