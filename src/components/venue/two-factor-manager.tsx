import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Factor = { id: string; friendly_name?: string | null; status: string };

/**
 * Autenticação em duas etapas por aplicativo autenticador (TOTP).
 * Enroll → QR Code → verificação do código de 6 dígitos.
 */
export function TwoFactorManager() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");

  async function refresh() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (error) return;
    setFactors(((data?.totp ?? []) as Factor[]).filter((f) => f.status === "verified"));
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function startEnroll() {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Autenticador ${new Date().toLocaleDateString("pt-BR")}`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    setBusy(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId: enroll.id });
    if (challenge.error) {
      setBusy(false);
      return toast.error(challenge.error.message);
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enroll.id,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Verificação em duas etapas ativada");
    setEnroll(null);
    setCode("");
    await refresh();
  }

  async function removeFactor(id: string) {
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Verificação em duas etapas desativada");
    await refresh();
  }

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            Verificação em duas etapas
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use um aplicativo autenticador (Google Authenticator, 1Password, Authy) para gerar códigos de acesso.
          </p>
        </div>
        {factors.length > 0 ? (
          <Badge variant="secondary" className="shrink-0">Ativa</Badge>
        ) : null}
      </div>

      {factors.length > 0 ? (
        <ul className="space-y-2">
          {factors.map((f) => (
            <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border px-3 py-2">
              <span className="min-w-0 truncate text-sm text-foreground">
                <Smartphone className="mr-2 inline h-4 w-4 shrink-0 text-muted-foreground" />
                {f.friendly_name || "Aplicativo autenticador"}
              </span>
              <Button variant="ghost" size="sm" className="shrink-0" disabled={busy} onClick={() => removeFactor(f.id)}>
                <Trash2 className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">Remover</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : enroll ? (
        <form onSubmit={confirmEnroll} className="space-y-3">
          <img
            src={enroll.qr}
            alt="QR Code para configurar o aplicativo autenticador"
            className="h-44 w-44 max-w-full rounded-md border border-border bg-background p-2"
          />
          <p className="text-xs text-muted-foreground">
            Não consegue ler o QR Code? Use a chave: <code className="break-all">{enroll.secret}</code>
          </p>
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={busy || code.length !== 6}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar"}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setEnroll(null)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" className="min-h-11" onClick={startEnroll} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar verificação em duas etapas"}
        </Button>
      )}
    </div>
  );
}
