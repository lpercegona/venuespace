import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Table as TableIcon } from "lucide-react";
import type { PublicTableSummary } from "@/lib/public.server";

async function fetchPublicTables(): Promise<{ items: PublicTableSummary[]; total: number }> {
  const res = await fetch("/api/public/tables?limit=12");
  if (!res.ok) throw new Error("Falha ao carregar");
  return res.json();
}

export function PublicTablesCarousel() {
  const q = useQuery({ queryKey: ["public-tables-carousel"], queryFn: fetchPublicTables, staleTime: 60_000 });

  if (q.isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  const items = q.data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <Carousel opts={{ align: "start", loop: false }} className="w-full">
      <CarouselContent className="-ml-4">
        {items.map((it) => (
          <CarouselItem key={it.table_id} className="basis-full pl-4 sm:basis-1/2 lg:basis-1/3">
            <Link
              to="/public/$slug/$tableId"
              params={{ slug: it.org_slug, tableId: it.table_id }}
              className="block outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
            >
              <Card className="h-full transition-shadow hover:shadow-elegant">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <TableIcon className="h-3.5 w-3.5" />
                    <span className="truncate">{it.org_name}</span>
                  </div>
                  <CardTitle className="font-display text-lg">{it.table_name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary">{it.published_count} {it.published_count === 1 ? "publicado" : "publicados"}</Badge>
                </CardContent>
              </Card>
            </Link>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
