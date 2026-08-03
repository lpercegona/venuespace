import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isImmersiveLayout, type LayoutItem } from "@/components/venue/public-card-renderer";

function isImageLikeKey(key: string) {
  return /(avatar|capa|cover|foto|galeria|gallery|imagem|image|logo|photo|picture)/i.test(key);
}

function spanFor(width: number) {
  return width === 25 ? "col-span-1" : width === 50 ? "col-span-2" : width === 75 ? "col-span-3" : "col-span-4";
}

/** Skeleton do card imersivo: imagem cheia + barras nos cantos. */
function ImmersiveSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <div className="relative">
        <Skeleton className="aspect-4/3 w-full rounded-none" />
        <div className="absolute inset-0 flex flex-col justify-between p-3">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/5" />
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-4 w-4 rounded-sm" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Skeleton do card padrão, desenhado a partir do layout definido pelo super admin. */
function LayoutSkeleton({ layout }: { layout: LayoutItem[] }) {
  const rows: LayoutItem[][] = [];
  let current: LayoutItem[] = [];
  let acc = 0;
  const flush = () => {
    if (current.length) {
      rows.push(current);
      current = [];
      acc = 0;
    }
  };
  for (const it of layout) {
    const bleed = it.width_percent === 100 && it.config?.bleed === true;
    if (bleed) {
      flush();
      rows.push([it]);
      continue;
    }
    if (acc + it.width_percent > 100) flush();
    current.push(it);
    acc += it.width_percent;
    if (acc >= 100) flush();
  }
  flush();

  return (
    <Card className="h-full overflow-hidden">
      <div className="space-y-2 p-4">
        {rows.map((row, i) => {
          const bleed = row.length === 1 && row[0].width_percent === 100 && row[0].config?.bleed === true;
          if (bleed) {
            const isFirst = i === 0;
            const isLast = i === rows.length - 1;
            return (
              <Skeleton
                key={row[0].id}
                className={`-mx-4 aspect-video w-auto rounded-none ${isFirst ? "-mt-4" : ""} ${isLast ? "-mb-4" : ""}`}
              />
            );
          }
          return (
            <div key={i} className="grid grid-cols-4 gap-2">
              {row.map((it) => {
                const span = spanFor(it.width_percent);
                if (isImageLikeKey(it.field_key)) {
                  const aspect = it.width_percent === 100 ? "aspect-video" : "aspect-square";
                  return <Skeleton key={it.id} className={`${span} ${aspect} w-full rounded-md`} />;
                }
                const style = it.config?.style;
                if (style === "title" || it.field_key === "name") {
                  return <Skeleton key={it.id} className={`${span} h-6 w-3/4`} />;
                }
                if (style === "subtitle") {
                  return <Skeleton key={it.id} className={`${span} h-3 w-2/3`} />;
                }
                return (
                  <div key={it.id} className={`${span} min-w-0 space-y-1.5`}>
                    <Skeleton className="h-2.5 w-1/2" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function PublicCardSkeleton({
  withLogo = false,
  layout,
}: {
  withLogo?: boolean;
  layout?: LayoutItem[] | null;
}) {
  if (layout && layout.length > 0) {
    return isImmersiveLayout(layout) ? <ImmersiveSkeleton /> : <LayoutSkeleton layout={layout} />;
  }
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          {withLogo ? <Skeleton className="h-10 w-10 shrink-0 rounded-md" /> : null}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="aspect-video w-full rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PublicCardSkeletonGrid({
  count = 4,
  withLogo = false,
  layout,
  className = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
}: { count?: number; withLogo?: boolean; layout?: LayoutItem[] | null; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <PublicCardSkeleton key={i} withLogo={withLogo} layout={layout} />
      ))}
    </div>
  );
}
