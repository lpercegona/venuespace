import { createFileRoute, notFound } from "@tanstack/react-router";
import { BackLink } from "@/components/venue/public-header";
import { useFormatContext } from "@/hooks/use-instance-context";
import { formatDate } from "@/lib/formatting";
import { getPublicBlogPostFn } from "@/lib/blog.functions";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const { post } = await getPublicBlogPostFn({ data: { slug: params.slug } });
    if (!post) throw notFound();
    return { post };
  },

  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Post — Venuespace" }, { name: "robots", content: "noindex" }] };
    }
    const p = loaderData.post as {
      title: string;
      subtitle: string | null;
      cover_url: string | null;
      seo_title: string | null;
      seo_description: string | null;
      content_text: string;
    };
    const title = p.seo_title || `${p.title} — Blog Venuespace`;
    const description = p.seo_description || p.subtitle || p.content_text.slice(0, 160);
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: p.cover_url ? "summary_large_image" : "summary" },
    ];
    if (p.cover_url) {
      meta.push({ property: "og:image", content: p.cover_url });
      meta.push({ name: "twitter:image", content: p.cover_url });
    }
    return { meta };
  },
  component: BlogPost,
  notFoundComponent: () => (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6">
      <h1 className="font-display text-2xl font-semibold">Post não encontrado</h1>
      <p className="mt-2 text-muted-foreground">O post que você procura não existe ou foi despublicado.</p>
    </section>
  ),
  errorComponent: () => (
    <section className="mx-auto w-full max-w-3xl px-4 py-16 text-center sm:px-6">
      <h1 className="font-display text-2xl font-semibold">Erro ao carregar</h1>
    </section>
  ),
});

function BlogPost() {
  const { post } = Route.useLoaderData() as any;
  const ctx = useFormatContext();

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6">
        <BackLink to="/blog" label="Voltar ao blog" />
      </div>
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {formatDate(post.published_at, ctx)}
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          {post.title}
        </h1>
        {post.subtitle ? (
          <p className="mt-4 text-lg text-muted-foreground">{post.subtitle}</p>
        ) : null}
      </header>

      {post.cover_url ? (
        <img
          src={post.cover_url}
          alt={post.cover_alt ?? post.title}
          loading="eager"
          decoding="async"
          className="mb-8 aspect-video w-full rounded-xl object-cover shadow-elegant"
        />
      ) : null}

      <div
        className="blog-content font-body text-base leading-relaxed text-foreground"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: post.content_html }}
      />
    </article>
  );
}
