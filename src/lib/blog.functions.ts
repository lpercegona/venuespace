import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeBlogHtml, htmlToText } from "@/lib/blog-sanitize";

export type BlogPostStatus = "draft" | "published";

export type BlogPostAdmin = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_image_path: string | null;
  cover_image_alt: string | null;
  content_html: string;
  status: BlogPostStatus;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type BlogPostListItem = Pick<
  BlogPostAdmin,
  "id" | "slug" | "title" | "subtitle" | "status" | "published_at" | "updated_at" | "cover_image_path"
>;

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas super admin.");
}

const slugRe = /^[a-z0-9-]{2,120}$/;

const upsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  slug: z.string().regex(slugRe, "Slug deve conter apenas letras minúsculas, números e hífens"),
  title: z.string().min(2).max(200),
  subtitle: z.string().max(400).nullable().optional(),
  cover_image_path: z.string().max(500).nullable().optional(),
  cover_image_alt: z.string().max(300).nullable().optional(),
  content_html: z.string().max(500_000),
  status: z.enum(["draft", "published"]),
  seo_title: z.string().max(200).nullable().optional(),
  seo_description: z.string().max(400).nullable().optional(),
});

export const listBlogPostsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id, slug, title, subtitle, status, published_at, updated_at, cover_image_path")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as BlogPostListItem[];
  });

export const getBlogPostAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id, slug, title, subtitle, cover_image_path, cover_image_alt, content_html, status, published_at, seo_title, seo_description, created_at, updated_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Post não encontrado.");
    return row as BlogPostAdmin;
  });

export const upsertBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const sanitized_html = sanitizeBlogHtml(data.content_html);
    const content_text = htmlToText(sanitized_html);
    const now = new Date().toISOString();

    const payload: any = {
      slug: data.slug,
      title: data.title.trim(),
      subtitle: data.subtitle?.trim() || null,
      cover_image_path: data.cover_image_path || null,
      cover_image_alt: data.cover_image_alt?.trim() || null,
      content_html: sanitized_html,
      content_text,
      status: data.status,
      seo_title: data.seo_title?.trim() || null,
      seo_description: data.seo_description?.trim() || null,
    };

    if (data.status === "published") {
      // set published_at when publishing for the first time
      if (data.id) {
        const { data: prev } = await supabaseAdmin
          .from("blog_posts")
          .select("published_at, status")
          .eq("id", data.id)
          .maybeSingle();
        payload.published_at = (prev as any)?.published_at ?? now;
      } else {
        payload.published_at = now;
      }
    } else {
      payload.published_at = null;
    }

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("blog_posts")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, slug: data.slug };
    } else {
      payload.author_user_id = context.userId;
      const { data: created, error } = await supabaseAdmin
        .from("blog_posts")
        .insert(payload)
        .select("id, slug")
        .single();
      if (error) throw new Error(error.message);
      return { id: (created as any).id as string, slug: (created as any).slug as string };
    }
  });

export const deleteBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const signBlogImagePath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("venue-uploads")
      .createSignedUrl(data.path, 60 * 60 * 24 * 7);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? "" };
  });

/** Leitura pública de posts (SSR-safe): usada pelos loaders das rotas /blog. */
export const listPublicBlogPostsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(60).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { listPublicBlogPosts } = await import("@/lib/blog-public.server");
    return { items: await listPublicBlogPosts(data.limit ?? 30) };
  });

export const getPublicBlogPostFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { getPublicBlogPostBySlug } = await import("@/lib/blog-public.server");
    return { post: await getPublicBlogPostBySlug(data.slug) };
  });
