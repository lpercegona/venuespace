import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PublicHeader } from "@/components/venue/public-header";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Venuespace" },
      { name: "description", content: "Acesse sua organização no Venuespace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app" });
    });
  }, [navigate]);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: signInEmail, password: signInPassword });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/app" });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signUpEmail,
      password: signUpPassword,
      options: { data: { full_name: signUpName }, emailRedirectTo: `${window.location.origin}/app` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada!");
    navigate({ to: "/app" });
  }

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setLoading(false);
      return toast.error((result.error as Error).message ?? "Falha ao entrar com Google");
    }
    if (result.redirected) return;
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showAuthActions={false} />
      <main className="grid min-h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-2">
        <section className="flex min-h-64 items-end overflow-hidden border-b border-border bg-linear-to-br from-surface via-muted to-primary/20 p-6 lg:min-h-full lg:border-b-0 lg:border-r lg:p-10">
          <div className="max-w-lg space-y-3 rounded-2xl border border-border bg-card/80 p-5 shadow-elegant backdrop-blur">
            <p className="text-sm font-medium text-primary">Venuespace</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Organize, publique e negocie em um só espaço.
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Área visual preparada para receber uma imagem institucional ou de produto sem alterar a estrutura da tela.
            </p>
          </div>
        </section>
        <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">


        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl">Acesse sua conta</CardTitle>
            <CardDescription>Entre ou crie sua conta para começar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full h-11" onClick={handleGoogle} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar com Google"}
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="in-email">E-mail</Label>
                    <Input id="in-email" type="email" required value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="in-pass">Senha</Label>
                    <Input id="in-pass" type="password" required minLength={8} value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="up-name">Nome</Label>
                    <Input id="up-name" required value={signUpName} onChange={(e) => setSignUpName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="up-email">E-mail</Label>
                    <Input id="up-email" type="email" required value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="up-pass">Senha</Label>
                    <Input id="up-pass" type="password" required minLength={8} value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        </div>
        </section>
      </main>
    </div>
  );
}
