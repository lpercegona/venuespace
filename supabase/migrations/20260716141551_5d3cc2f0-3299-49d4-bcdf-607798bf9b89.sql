
CREATE TYPE public.blog_post_status AS ENUM ('draft', 'published');

CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  cover_image_path text,
  cover_image_alt text,
  content_html text NOT NULL DEFAULT '',
  content_text text NOT NULL DEFAULT '',
  status public.blog_post_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_slug_format CHECK (slug ~ '^[a-z0-9-]{2,120}$')
);

CREATE INDEX blog_posts_status_published_at_idx ON public.blog_posts (status, published_at DESC);

GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon reads published posts"
  ON public.blog_posts FOR SELECT TO anon
  USING (status = 'published');

CREATE POLICY "Authenticated reads published posts"
  ON public.blog_posts FOR SELECT TO authenticated
  USING (status = 'published' OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin inserts posts"
  ON public.blog_posts FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin updates posts"
  ON public.blog_posts FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin deletes posts"
  ON public.blog_posts FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER blog_posts_set_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
