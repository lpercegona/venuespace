import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PublicBlogListItem = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  cover_alt: string | null;
  published_at: string;
};

export type PublicBlogPost = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  cover_alt: string | null;
  content_html: string;
  content_text: string;
  published_at: string;
  seo_title: string | null;
  seo_description: string | null;
};

async function signCovers(paths: (string | null)[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const list = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (list.length === 0) return map;
  const { data } = await supabaseAdmin.storage.from("venue-uploads").createSignedUrls(list, 60 * 60);
  for (let i = 0; i < list.length; i += 1) {
    const url = (data ?? [])[i]?.signedUrl;
    if (url) map.set(list[i], url);
  }
  return map;
}

export async function listPublicBlogPosts(limit = 20): Promise<PublicBlogListItem[]> {
  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select("id, slug, title, subtitle, cover_image_path, cover_image_alt, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 60));
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  const signed = await signCovers(rows.map((r) => r.cover_image_path));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    cover_url: r.cover_image_path ? signed.get(r.cover_image_path) ?? null : null,
    cover_alt: r.cover_image_alt,
    published_at: r.published_at,
  }));
}

export async function getPublicBlogPostBySlug(slug: string): Promise<PublicBlogPost | null> {
  const { data, error } = await supabaseAdmin
    .from("blog_posts")
    .select("id, slug, title, subtitle, cover_image_path, cover_image_alt, content_html, content_text, published_at, seo_title, seo_description")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as any;
  const signed = await signCovers([r.cover_image_path]);
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    cover_url: r.cover_image_path ? signed.get(r.cover_image_path) ?? null : null,
    cover_alt: r.cover_image_alt,
    content_html: r.content_html,
    content_text: r.content_text,
    published_at: r.published_at,
    seo_title: r.seo_title,
    seo_description: r.seo_description,
  };
}
