import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, User, Bell, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { TwoFactorManager } from "@/components/venue/two-factor-manager";
import { optimizeImage } from "@/lib/image-optimizer";

type Section = "profile" | "notifications" | "security";

const SECTIONS: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "profile", label: "Perfil", icon: User },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "security", label: "Segurança", icon: Shield },
];

export function SettingsModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [section, setSection] = useState<Section>("profile");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-hidden p-0 sm:h-[560px]">
        <DialogTitle className="sr-only">Configurações</DialogTitle>
        <div className="grid h-full grid-cols-1 sm:grid-cols-[200px_1fr]">
          <aside className="border-b border-border bg-muted/40 p-3 sm:border-b-0 sm:border-r">
            <p className="px-2 pb-2 font-display text-sm font-semibold text-foreground">Configurações</p>
            <nav className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = s.id === section;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSection(s.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm outline-hidden transition-colors focus-visible:ring-3 focus-visible:ring-ring",
                      active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
          <div className="min-h-0 overflow-y-auto p-6">
            {section === "profile" ? <ProfileSection /> : null}
            {section === "notifications" ? (
              <SectionPlaceholder title="Notificações" description="Em breve você poderá ajustar preferências de notificações in-app." />
            ) : null}
            {section === "security" ? <SecuritySection /> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ProfileSection() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me-profile"], queryFn: () => getMyProfile() });
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (me.data) {
      setDisplayName(me.data.display_name ?? "");
      setAvatarUrl(me.data.avatar_url ?? null);
    }
  }, [me.data]);

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;
    setUploading(true);
    try {
      const file = await optimizeImage(original, { maxSide: 512 });
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sem sessão");
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("venue-uploads").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("venue-uploads").createSignedUrl(path, 60 * 60 * 24 * 30);
      setAvatarUrl(signed?.signedUrl ?? path);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMyProfile({ data: { display_name: displayName, avatar_url: avatarUrl } });
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["me-profile"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (me.isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">Perfil</h2>
        <p className="text-sm text-muted-foreground">Como você aparece no Venuespace.</p>
      </div>
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback>{(displayName || me.data?.email || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <input id="s-avatar" type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          <label htmlFor="s-avatar">
            <Button type="button" variant="outline" size="sm" asChild>
              <span><Upload className="h-4 w-4" />{uploading ? "Enviando..." : "Trocar foto"}</span>
            </Button>
          </label>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="s-name">Nome de exibição</Label>
        <Input id="s-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>E-mail</Label>
        <Input value={me.data?.email ?? ""} disabled />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
      </div>
    </form>
  );
}

function SecuritySection() {
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < 8) return toast.error("A senha deve ter ao menos 8 caracteres.");
    if (pass !== confirm) return toast.error("As senhas não conferem.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada");
    setPass("");
    setConfirm("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">Segurança</h2>
        <p className="text-sm text-muted-foreground">Defina uma nova senha e ative a verificação em duas etapas.</p>
      </div>
      <TwoFactorManager />
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="s-pass">Nova senha</Label>
          <Input id="s-pass" type="password" minLength={8} required value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-pass2">Confirmar senha</Label>
          <Input id="s-pass2" type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar senha"}</Button>
        </div>
      </form>
    </div>
  );
}

