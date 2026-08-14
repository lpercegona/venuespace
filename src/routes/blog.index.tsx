import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatContext } from "@/hooks/use-instance-context";
import { formatDate } from "@/lib/formatting";
import { listPublicBlogPostsFn } from "@/lib/blog.functions";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — Venuespace" },
      { name: "description", content: "Notícias, guias e histórias sobre espaços para eventos." },
      { property: "og:title", content: "Blog — Venuespace" },
      { property: "og:description", content: "Notícias, guias e histórias sobre espaços para eventos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BlogIndex,
});

type Item = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  cover_alt: string | null;
  published_at: string;
};

async function fetchPosts(): Promise<{ items: Item[] }> {
  return (await listPublicBlogPostsFn({ data: { limit: 30 } })) as { items: Item[] };
}


function BlogIndex() {
  const ctx = useFormatContext();
  const q = useQuery({ queryKey: ["public-blog"], queryFn: fetchPosts, staleTime: 60_000 });

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8 max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Blog</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          Ideias, guias e histórias sobre eventos
        </h1>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          Artigos publicados pela equipe Venuespace.
        </p>
      </header>

      {q.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (q.data?.items ?? []).length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <BookOpen className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum post publicado ainda.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(q.data?.items ?? []).map((p) => (
            <Link
              key={p.id}
              to="/blog/$slug"
              params={{ slug: p.slug }}
              className="group block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="h-full overflow-hidden transition-shadow hover:shadow-elegant">
                {p.cover_url ? (
                  <img
                    src={p.cover_url}
                    alt={p.cover_alt ?? p.title}
                    loading="lazy"
                    decoding="async"
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="aspect-video w-full bg-muted" />
                )}
                <CardHeader className="pb-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {formatDate(p.published_at, ctx)}
                  </p>
                  <CardTitle className="font-display text-lg leading-snug group-hover:text-primary">
                    {p.title}
                  </CardTitle>
                </CardHeader>
                {p.subtitle ? (
                  <CardContent>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{p.subtitle}</p>
                  </CardContent>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
