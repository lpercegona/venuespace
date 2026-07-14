import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { AppShell } from "@/components/venue/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/me/settings")({
  head: () => ({ meta: [{ title: "Configurações — Venuespace" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
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
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sem sessão");
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("venue-uploads").upload(path, file, { upsert: true });
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

  return (
    <AppShell title="Configurações" subtitle="Perfil do usuário">
      {me.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <form onSubmit={handleSave} className="max-w-xl">
          <Card>
            <CardHeader><CardTitle className="font-display text-base">Seu perfil</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                  <AvatarFallback>{(displayName || me.data?.email || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <input id="avatar" type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
                  <label htmlFor="avatar">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span><Upload className="h-4 w-4" />{uploading ? "Enviando..." : "Trocar foto"}</span>
                    </Button>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">Nome de exibição</Label>
                <Input id="display_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={me.data?.email ?? ""} disabled />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </AppShell>
  );
}
