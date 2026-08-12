import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { PublicCardBody } from "@/components/venue/public-card-renderer";
import { OrgLogo } from "@/components/venue/org-logo";
import { PublicCardSkeletonGrid } from "@/components/venue/public-card-skeleton";
import { categorySlug, usePublicCategories } from "@/components/venue/category-tabs";
import { HomeSearchBar } from "@/components/venue/home-search-bar";

import {
  categoryLayoutQuery,
  homeGroupingDataQuery,
  homeGroupingsQuery,
  publicCategoriesQuery,
} from "@/lib/public-queries";
import type { LayoutItem } from "@/components/venue/public-card-renderer";

import type { PublicOrganizationSummary, PublicRecordSummary } from "@/lib/public.server";
import type { HomeGroupingDTO, HomeBlockDTO } from "@/lib/home-config.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Venuespace — espaços para eventos" },
      {
        name: "description",
        content:
          "Encontre e publique espaços e fornecedores de eventos. Perfis, fotos, propostas e negociação em um só lugar.",
      },
      { property: "og:title", content: "Venuespace — espaços para eventos" },
      {
        property: "og:description",
        content:
          "Encontre e publique espaços e fornecedores de eventos. Perfis, fotos, propostas e negociação em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    const qc = context.queryClient;
    qc.prefetchQuery(publicCategoriesQuery());
    const config = await qc.ensureQueryData(homeGroupingsQuery());
    const first = (config as { groupings: HomeGroupingDTO[] }).groupings?.[0];
    // Não bloqueia o HTML: os blocos chegam via streaming enquanto o skeleton
    // já reflete o layout configurado.
    if (first) qc.prefetchQuery(homeGroupingDataQuery(first.id));
  },
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground" role="alert">
      {(error as Error).message}
    </div>
  ),
  component: Landing,
});

type GroupingData = {
  blocks: Array<{
    id: string;
    items: (PublicOrganizationSummary | PublicRecordSummary)[];
    links: Array<{
      title: string;
      image_url?: string | null;
      field_key?: string | null;
      value?: string | null;
      category_id?: string | null;
      category_slug?: string | null;
    }>;
  }>;
};

function gridClass(columns: 3 | 4) {
  return columns === 4 ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
}

function Landing() {
  const groupingsQ = useQuery(homeGroupingsQuery());
  const groupings = (groupingsQ.data?.groupings ?? []) as HomeGroupingDTO[];
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const activeGrouping = groupings.find((g) => g.slug === (activeSlug ?? groupings[0]?.slug)) ?? groupings[0];

  const dataQ = useQuery(homeGroupingDataQuery(activeGrouping?.id));

  // Layouts configurados pelo super admin — usados para o skeleton refletir o card real.
  const categoryId = activeGrouping?.category_ids?.[0];
  const catsQ = usePublicCategories();
  const activeCategory = (catsQ.data ?? []).find((c) => c.id === categoryId);
  const activeCategorySlug = activeCategory ? categorySlug(activeCategory) : undefined;
  const orgLayoutQ = useQuery(categoryLayoutQuery(categoryId, "organization_card"));
  const recLayoutQ = useQuery(categoryLayoutQuery(categoryId, "record_card"));

  const data = dataQ.data as GroupingData | undefined;
  const byBlock = new Map((data?.blocks ?? []).map((b) => [b.id, b]));
  const visibleBlocks = (activeGrouping?.blocks ?? []).filter((b) => {
    if (dataQ.isLoading) return true;
    const d = byBlock.get(b.id);
    if (!d) return false;
    return b.block_type === "links" ? d.links.length > 0 : d.items.length > 0;
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      {/* Hero */}
      <section className="relative -mt-[57px] bg-primary pb-24 pt-[85px] text-primary-foreground sm:pb-32 sm:pt-24">
        <div className="mx-auto w-full max-w-6xl px-4 text-center sm:px-6">
          <h1 className="mx-auto max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Encontre espaços e fornecedores de eventos
          </h1>

          <HomeSearchBar categoryId={categoryId} categorySlug={activeCategorySlug} />

          {/* Pill toggle */}
          {groupings.length > 1 ? (
            <div className="mt-8 inline-flex rounded-full bg-primary-foreground/15 p-1 backdrop-blur-sm">
              {groupings.map((g) => {
                const active = activeGrouping?.slug === g.slug;
                return (
                  <button
                    key={g.slug}
                    onClick={() => setActiveSlug(g.slug)}
                    className={`rounded-full px-5 py-2 text-sm font-medium transition-colors sm:px-7 sm:text-base ${
                      active
                        ? "bg-primary-foreground text-primary"
                        : "text-primary-foreground hover:bg-primary-foreground/10"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      {/* Content panel */}
      <main className="relative -mt-16 flex-1 rounded-t-3xl bg-background px-4 pb-16 pt-8 sm:-mt-20 sm:rounded-t-[2rem] sm:px-6 sm:pt-12">
        <div className="mx-auto w-full max-w-6xl space-y-14">
          {groupingsQ.isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-8 w-48" />
              <PublicCardSkeletonGrid count={3} withLogo />
            </div>
          ) : activeGrouping ? (
            visibleBlocks.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">Nenhum bloco configurado para esta aba.</p>
            ) : (
              visibleBlocks.map((block) => (
                <HomeBlockSection
                  key={block.id}
                  block={block}
                  data={byBlock.get(block.id)}
                  isLoading={dataQ.isLoading}
                  layout={block.source === "records" ? recLayoutQ.data : orgLayoutQ.data}
                  categorySlug={activeCategorySlug}
                />
              ))
            )
          ) : (
            <p className="text-center text-sm text-muted-foreground">Nenhuma categoria configurada.</p>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function HomeBlockSection({
  block,
  data,
  isLoading,
  layout,
  categorySlug: catSlug,
}: {
  block: HomeBlockDTO;
  data: GroupingData["blocks"][number] | undefined;
  isLoading: boolean;
  layout?: LayoutItem[] | null;
  categorySlug?: string;
}) {
  const columns = (block.columns ?? 3) as 3 | 4;

  // "Ver todos" reaplica as regras "=" do bloco como filtros na listagem.
  const seeAllSearch: Record<string, string> = {};
  for (const rule of block.rules ?? []) {
    if (rule.operator === "=" && rule.field_key && rule.value) seeAllSearch[`f_${rule.field_key}`] = rule.value;
  }
  // Sem categoria definida, o destino é /explore e a categoria vai na URL.
  const exploreSearch = catSlug ? { ...seeAllSearch, categoria: catSlug } : seeAllSearch;


  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{block.title}</h2>
        {block.show_see_all !== false ? (
          catSlug ? (
            <Link
              to="/categoria/$slug"
              params={{ slug: catSlug }}
              search={seeAllSearch as any}
              preload="intent"
              className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver todos
            </Link>
          ) : (
            <Link
              to="/explore"
              search={exploreSearch as any}
              preload="intent"
              className="shrink-0 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver todos
            </Link>
          )
        ) : null}
      </div>


      {isLoading ? (
        block.block_type === "links" ? (
          <div className={gridClass(columns)}>
            {Array.from({ length: block.limit_count }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <PublicCardSkeletonGrid
            count={block.limit_count}
            withLogo={block.source !== "records"}
            layout={layout}
            className={gridClass(columns)}
          />
        )
      ) : block.block_type === "links" ? (
        <div className={gridClass(columns)}>
          {(data?.links ?? []).map((link, i) => (
            <ShortcutCard key={`${link.title}-${i}`} link={link} />
          ))}
        </div>
      ) : (data?.items ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum resultado nesta seção.</p>
      ) : (
        <div className={gridClass(columns)}>
          {(data?.items ?? []).map((item) =>
            "slug" in item ? (
              <OrganizationCard key={item.id} org={item as PublicOrganizationSummary} />
            ) : (
              <RecordCard key={(item as PublicRecordSummary).record_id} record={item as PublicRecordSummary} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

function ShortcutCard({
  link,
}: {
  link: {
    title: string;
    image_url?: string | null;
    field_key?: string | null;
    value?: string | null;
    category_slug?: string | null;
  };
}) {
  const search: Record<string, string> = {};
  if (link.field_key && link.value) search[`f_${link.field_key}`] = link.value;

  const catsQ = usePublicCategories();
  const fallbackSlug = (catsQ.data ?? [])[0] ? categorySlug((catsQ.data ?? [])[0]!) : "";
  const slug = link.category_slug || fallbackSlug;

  if (!slug) return null;

  return (
    <Link
      to="/categoria/$slug"
      params={{ slug }}
      search={search as any}
      preload="intent"
      className="group block overflow-hidden rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative h-40 w-full overflow-hidden rounded-xl bg-muted">
        {link.image_url ? (
          <img
            src={link.image_url}
            alt={link.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-0 bg-foreground/40" />
        <span className="absolute inset-x-0 bottom-0 p-4 font-display text-lg font-semibold text-background">
          {link.title}
        </span>
      </div>
    </Link>
  );
}

function OrganizationCard({ org }: { org: PublicOrganizationSummary }) {
  return (
    <Link
      to="/public/$slug"
      params={{ slug: org.slug }}
      preload="intent"
      className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-elegant">
        {org.layout && org.layout.length > 0 ? (
          <div className="p-4">
            <PublicCardBody layout={org.layout as any} fields={org.fields as any} data={org.data} orgName={org.name} />
          </div>
        ) : (
          <div className="flex h-full flex-col p-4">
            <div className="flex items-center gap-3">
              <OrgLogo src={org.logo_url} alt={`Logo ${org.name}`} className="h-10 w-10" />
              <h3 className="font-display text-base font-semibold line-clamp-2">{org.name}</h3>
            </div>
            {org.description ? (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{org.description}</p>
            ) : null}
          </div>
        )}
      </Card>
    </Link>
  );
}

function RecordCard({ record }: { record: PublicRecordSummary }) {
  return (
    <Link
      to="/public/$slug/$tableId"
      params={{ slug: record.org_slug, tableId: record.table_id }}
      preload="intent"
      className="block rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-elegant">
        {record.layout && record.layout.length > 0 ? (
          <div className="p-4">
            <PublicCardBody layout={record.layout as any} fields={record.fields as any} data={record.data} />
          </div>
        ) : (
          <div className="p-4">
            <h3 className="font-display text-base font-semibold">{record.table_name}</h3>
            <p className="text-sm text-muted-foreground">{record.org_name}</p>
          </div>
        )}
      </Card>
    </Link>
  );
}
