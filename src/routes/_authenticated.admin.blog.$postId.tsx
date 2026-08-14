import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Upload, X } from "lucide-react";

import { AppShell } from "@/components/venue/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { TiptapEditor } from "@/components/venue/tiptap-editor";
import { getBlogPostAdmin, upsertBlogPost, signBlogImagePath } from "@/lib/blog.functions";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slug";
import { optimizeImage } from "@/lib/image-optimizer";

export const Route = createFileRoute("/_authenticated/admin/blog/$postId")({
  head: () => ({ meta: [{ title: "Post — Admin Venuespace" }, { name: "robots", content: "noindex" }] }),
  component: BlogEditor,
});

function BlogEditor() {
  const { postId } = Route.useParams();
  const isNew = postId === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverAlt, setCoverAlt] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const post = useQuery({
    queryKey: ["blog-post", postId],
    queryFn: () => getBlogPostAdmin({ data: { id: postId } }),
    enabled: !isNew,
  });

  useEffect(() => {
    if (!post.data) return;
    const p = post.data;
    setTitle(p.title);
    setSlug(p.slug);
    setSlugTouched(true);
    setSubtitle(p.subtitle ?? "");
    setCoverPath(p.cover_image_path);
    setCoverAlt(p.cover_image_alt ?? "");
    setContentHtml(p.content_html ?? "");
    setSeoTitle(p.seo_title ?? "");
    setSeoDescription(p.seo_description ?? "");
    setPublished(p.status === "published");
    if (p.cover_image_path) {
      signBlogImagePath({ data: { path: p.cover_image_path } })
        .then((r) => setCoverUrl(r.url))
        .catch(() => setCoverUrl(null));
    }
  }, [post.data]);

  useEffect(() => {
    if (!slugTouched && title) setSlug(slugify(title).slice(0, 120));
  }, [title, slugTouched]);

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    e.target.value = "";
    if (!original) return;
    setUploadingCover(true);
    try {
      const file = await optimizeImage(original);
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? "anon";
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${uid}/blog/covers/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("venue-uploads").upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const r = await signBlogImagePath({ data: { path } });
      setCoverPath(path);
      setCoverUrl(r.url);
    } catch (err) { toast.error((err as Error).message); }
    finally { setUploadingCover(false); }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await upsertBlogPost({
        data: {
          id: isNew ? null : postId,
          slug,
          title,
          subtitle: subtitle || null,
          cover_image_path: coverPath,
          cover_image_alt: coverAlt || null,
          content_html: contentHtml,
          status: published ? "published" : "draft",
          seo_title: seoTitle || null,
          seo_description: seoDescription || null,
        },
      });
      toast.success(isNew ? "Post criado" : "Post salvo");
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      qc.invalidateQueries({ queryKey: ["blog-post", postId] });
      qc.invalidateQueries({ queryKey: ["public-blog"] });
      if (isNew) navigate({ to: "/admin/blog/$postId", params: { postId: r.id } });
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  const loading = !isNew && post.isLoading;

  return (
    <AppShell
      title={isNew ? "Novo post" : "Editar post"}
      subtitle="Blog gerenciado pelo super admin"
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin"><ArrowLeft className="h-4 w-4" />Voltar ao admin</Link>
        </Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="font-display">Conteúdo</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} required placeholder="meu-post" />
                  <p className="text-xs text-muted-foreground">URL pública: /blog/{slug || "..."}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subtitle">Subtítulo</Label>
                  <Textarea id="subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} rows={2} maxLength={400} />
                </div>
                <div className="space-y-2">
                  <Label>Corpo do post</Label>
                  <TiptapEditor value={contentHtml} onChange={setContentHtml} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="font-display">Publicação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Publicado</p>
                    <p className="text-xs text-muted-foreground">Rascunho fica invisível ao público.</p>
                  </div>
                  <Switch checked={published} onCheckedChange={setPublished} />
                </div>
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" />Salvar</>}
                </Button>
                {!isNew && published ? (
                  <Button type="button" variant="outline" className="w-full" asChild>
                    <a href={`/blog/${slug}`} target="_blank" rel="noreferrer">Ver publicação</a>
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-display">Capa</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {coverUrl ? (
                  <div className="space-y-2">
                    <img src={coverUrl} alt={coverAlt || title} className="aspect-video w-full rounded-md object-cover" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setCoverPath(null); setCoverUrl(null); }}>
                      <X className="h-4 w-4" />Remover
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Sem capa</div>
                )}
                <label className="inline-flex w-full">
                  <input type="file" accept="image/*" className="hidden" onChange={onPickCover} />
                  <Button type="button" variant="outline" size="sm" className="w-full" disabled={uploadingCover} asChild>
                    <span>{uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" />{coverPath ? "Substituir" : "Enviar imagem"}</>}</span>
                  </Button>
                </label>
                <div className="space-y-2">
                  <Label htmlFor="alt">Texto alternativo</Label>
                  <Input id="alt" value={coverAlt} onChange={(e) => setCoverAlt(e.target.value)} maxLength={300} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-display">SEO</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="seo-title">Título (SEO)</Label>
                  <Input id="seo-title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seo-desc">Descrição (SEO)</Label>
                  <Textarea id="seo-desc" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={3} maxLength={400} />
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      )}
    </AppShell>
  );
}
