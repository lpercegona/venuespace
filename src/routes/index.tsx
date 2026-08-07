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

async function fetchBlockData(
  block: HomeBlockDTO,
): Promise<{ items: (PublicOrganizationSummary | PublicRecordSummary)[] }> {
  const p = new URLSearchParams();
  p.set("source", block.source);
  p.set("limit", String(block.limit_count));
  if (block.order_by) p.set("order_by", block.order_by);
  if (block.rules.length > 0) p.set("rules", JSON.stringify(block.rules));
  const res = await fetch(`/api/public/home-block-data?${p.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar bloco");
  return res.json();
}

function Landing() {
  const catsQ = usePublicCategories();
  const groupingsQ = useQuery({
    queryKey: ["home-groupings"],
    queryFn: fetchHomeGroupings,
    staleTime: 60_000,
  });
  const groupings = groupingsQ.data?.groupings ?? [];
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const activeGrouping = groupings.find((g) => g.slug === (activeSlug ?? groupings[0]?.slug)) ?? groupings[0];

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

          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="h-12 bg-primary-foreground px-6 text-primary hover:bg-primary-foreground/90">
                Cadastrar meu espaço
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
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
            <>
              {(activeGrouping.blocks ?? []).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">Nenhum bloco configurado para esta aba.</p>
              ) : (
                (activeGrouping.blocks ?? []).map((block) => (
                  <HomeBlockSection key={block.id} block={block} />
                ))
              )}
            </>
          ) : (
            <p className="text-center text-sm text-muted-foreground">Nenhuma categoria configurada.</p>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function HomeBlockSection({ block }: { block: HomeBlockDTO }) {
  const q = useQuery({
    queryKey: ["home-block", block.id],
    queryFn: () => fetchBlockData(block),
    staleTime: 60_000,
  });

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{block.title}</h2>
      </div>

      {q.isLoading ? (
        <PublicCardSkeletonGrid count={block.limit_count} withLogo />
      ) : (q.data?.items ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum resultado nesta seção.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(q.data?.items ?? []).map((item) =>
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
