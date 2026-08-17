import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { VenuespaceLogo } from "@/components/venue/venuespace-logo";
import { PublicHeader } from "@/components/venue/public-header";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { OAUTH_REDIRECT_KEY } from "@/routes/auth_.callback";
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
  /** Etapa extra quando a conta tem verificação em duas etapas ativa. */
  const [mfa, setMfa] = useState<{ factorId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  /** Conta criada aguardando confirmação de e-mail. */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  /** Fluxo de recuperação de senha dentro do mesmo cartão. */
  const [forgot, setForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

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

  /** Encaminha para /app ou pede o código de 2FA quando exigido. */
  async function finishSignIn() {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!error && data?.currentLevel === "aal1" && data?.nextLevel === "aal2") {
      const list = await supabase.auth.mfa.listFactors();
      const factor = (list.data?.totp ?? []).find((f) => f.status === "verified");
      if (factor) {
        setMfa({ factorId: factor.id });
        return;
      }
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/app" });
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: signInEmail, password: signInPassword });
    if (error) {
      setLoading(false);
      if (/confirm/i.test(error.message)) {
        setPendingEmail(signInEmail);
        return toast.error("Confirme seu e-mail para entrar.");
      }
      return toast.error(error.message);
    }
    await finishSignIn();
    setLoading(false);
  }

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!mfa) return;
    setLoading(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId: mfa.factorId });
    if (challenge.error) {
      setLoading(false);
      return toast.error(challenge.error.message);
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfa.factorId,
      challengeId: challenge.data.id,
      code: mfaCode.trim(),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/app" });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: signUpEmail,
      password: signUpPassword,
      options: { data: { full_name: signUpName }, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data.session) {
      setPendingEmail(signUpEmail);
      return toast.success("Enviamos um link de confirmação para seu e-mail.");
    }
    toast.success("Conta criada!");
    navigate({ to: "/app" });
  }

  async function resendConfirmation() {
    if (!pendingEmail) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Link de confirmação reenviado.");
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setLoading(false);
    // Resposta neutra: não revela se o e-mail existe na base.
    setForgotSent(true);
  }

  async function handleGoogle() {
    setLoading(true);
    sessionStorage.setItem(OAUTH_REDIRECT_KEY, "/app");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth/callback`,
    });
    if (result.error) {
      setLoading(false);
      return toast.error((result.error as Error).message ?? "Falha ao entrar com Google");
    }
    if (result.redirected) return;
    navigate({ to: "/auth/callback" });
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader showAuthActions={false} />
      <main className="grid min-h-[calc(100vh-65px)] grid-cols-1 lg:grid-cols-2">
        <section
          className="
    relative min-h-64 overflow-hidden border-b border-border
    bg-cover bg-center
    p-6 lg:min-h-full lg:border-b-0 lg:border-r lg:p-10
    before:absolute before:inset-0 before:z-0
    before:bg-linear-to-tr before:from-primary/95 before:to-primary/70
  "
          style={{ backgroundImage: "url('/public/Imagem-autenticacao-resize.jpg')" }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-1 max-w-lg space-y-3 rounded-2xl border border-border bg-card/80 p-5 shadow-elegant backdrop-blur">
            <p className="text-sm font-medium text-primary">Venuespace</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Organize, publique e negocie a locação de espaços.
            </h1>
          </div>
        </section>
        <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <Card className="hover:shadow-lg hover:shadow-primary/20 transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="font-display text-xl">Acesse sua conta</CardTitle>
                <CardDescription>Entre ou crie sua conta para começar.</CardDescription>
              </CardHeader>
              <CardContent>
                {mfa ? (
                  <form onSubmit={handleMfaVerify} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Digite o código de 6 dígitos do seu aplicativo autenticador.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="mfa-login-code">Código</Label>
                      <Input
                        id="mfa-login-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        required
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                    <Button type="submit" className="h-11 w-full" disabled={loading || mfaCode.length !== 6}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
                    </Button>
                  </form>
                ) : forgot ? (
                  forgotSent ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha. Verifique também a
                        caixa de spam.
                      </p>
                      <Button
                        variant="ghost"
                        className="h-11 w-full"
                        onClick={() => {
                          setForgot(false);
                          setForgotSent(false);
                        }}
                      >
                        Voltar para o login
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgot} className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Informe seu e-mail e enviaremos um link para criar uma nova senha.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">E-mail</Label>
                        <Input
                          id="forgot-email"
                          type="email"
                          required
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                        />
                      </div>
                      <Button type="submit" className="h-11 w-full" disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link de recuperação"}
                      </Button>
                      <Button variant="ghost" className="h-11 w-full" onClick={() => setForgot(false)}>
                        Voltar
                      </Button>
                    </form>
                  )
                ) : pendingEmail ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Enviamos um link de confirmação para <strong className="text-foreground">{pendingEmail}</strong>.
                      Confirme seu e-mail para acessar a plataforma.
                    </p>
                    <Button className="h-11 w-full" onClick={resendConfirmation} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reenviar link de confirmação"}
                    </Button>
                    <Button variant="ghost" className="h-11 w-full" onClick={() => setPendingEmail(null)}>
                      Voltar
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button variant="outline" className="w-full h-11" onClick={handleGoogle} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar com Google"}
                    </Button>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
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
                            <Input
                              id="in-email"
                              type="email"
                              required
                              value={signInEmail}
                              onChange={(e) => setSignInEmail(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="in-pass">Senha</Label>
                            <Input
                              id="in-pass"
                              type="password"
                              required
                              minLength={8}
                              value={signInPassword}
                              onChange={(e) => setSignInPassword(e.target.value)}
                            />
                          </div>
                          <Button type="submit" className="w-full h-11" disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                          </Button>
                          <button
                            type="button"
                            className="mx-auto block text-xs font-medium text-primary hover:underline"
                            onClick={() => {
                              setForgotEmail(signInEmail);
                              setForgot(true);
                            }}
                          >
                            Esqueci minha senha
                          </button>
                        </form>
                      </TabsContent>
                      <TabsContent value="signup">
                        <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label htmlFor="up-name">Nome</Label>
                            <Input
                              id="up-name"
                              required
                              value={signUpName}
                              onChange={(e) => setSignUpName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="up-email">E-mail</Label>
                            <Input
                              id="up-email"
                              type="email"
                              required
                              value={signUpEmail}
                              onChange={(e) => setSignUpEmail(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="up-pass">Senha</Label>
                            <Input
                              id="up-pass"
                              type="password"
                              required
                              minLength={8}
                              value={signUpPassword}
                              onChange={(e) => setSignUpPassword(e.target.value)}
                            />
                          </div>
                          <Button type="submit" className="w-full h-11" disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
                          </Button>
                        </form>
                      </TabsContent>
                    </Tabs>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
