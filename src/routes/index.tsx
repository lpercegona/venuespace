import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { PublicCardBody } from "@/components/venue/public-card-renderer";
import { OrgLogo } from "@/components/venue/org-logo";
import { PublicCardSkeletonGrid } from "@/components/venue/public-card-skeleton";
import { categorySlug, usePublicCategories } from "@/components/venue/category-tabs";
import { useCategoryLayout } from "@/hooks/use-public-catalog";

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
  component: Landing,
});

async function fetchHomeGroupings(): Promise<{ groupings: HomeGroupingDTO[] }> {
  const res = await fetch("/api/public/home-config");
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}

type GroupingData = {
  blocks: Array<{
    id: string;
    items: (PublicOrganizationSummary | PublicRecordSummary)[];
    links: Array<{ title: string; image_url?: string | null; field_key?: string | null; value?: string | null }>;
  }>;
};

async function fetchGroupingData(groupingId: string): Promise<GroupingData> {
  const res = await fetch(`/api/public/home-grouping-data?grouping_id=${encodeURIComponent(groupingId)}`);
  if (!res.ok) throw new Error("Falha ao carregar blocos");
  return res.json();
}

function gridClass(columns: 3 | 4) {
  return columns === 4
    ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
}

function Landing() {
  const groupingsQ = useQuery({
    queryKey: ["home-groupings"],
    queryFn: fetchHomeGroupings,
    staleTime: 60_000,
  });
  const groupings = groupingsQ.data?.groupings ?? [];
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const activeGrouping = groupings.find((g) => g.slug === (activeSlug ?? groupings[0]?.slug)) ?? groupings[0];

  const dataQ = useQuery({
    queryKey: ["home-grouping-data", activeGrouping?.id],
    queryFn: () => fetchGroupingData(activeGrouping!.id),
    enabled: !!activeGrouping?.id,
    staleTime: 60_000,
  });

  const byBlock = new Map((dataQ.data?.blocks ?? []).map((b) => [b.id, b]));
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
      <section className="relative bg-primary pb-24 pt-12 text-primary-foreground sm:pb-32 sm:pt-20">
        <div className="mx-auto w-full max-w-6xl px-4 text-center sm:px-6">
          <h1 className="mx-auto max-w-3xl font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Encontre espaços e fornecedores de eventos
          </h1>

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
                      active ? "bg-primary-foreground text-primary" : "text-primary-foreground hover:bg-primary-foreground/10"
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
}: {
  block: HomeBlockDTO;
  data: GroupingData["blocks"][number] | undefined;
  isLoading: boolean;
}) {
  const columns = (block.columns ?? 3) as 3 | 4;

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{block.title}</h2>
      </div>

      {isLoading ? (
        <PublicCardSkeletonGrid count={block.limit_count} withLogo />
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
  link: { title: string; image_url?: string | null; field_key?: string | null; value?: string | null };
}) {
  const search: Record<string, string> = {};
  if (link.field_key && link.value) search[`f_${link.field_key}`] = link.value;

  return (
    <Link
      to="/explore"
      search={search as any}
      className="group block overflow-hidden rounded-xl outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative h-40 w-full overflow-hidden rounded-xl bg-muted">
        {link.image_url ? (
          <img
            src={link.image_url}
            alt={link.title}
            loading="lazy"
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
            {org.description ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{org.description}</p> : null}
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

