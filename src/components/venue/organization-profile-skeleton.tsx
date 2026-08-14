import { Skeleton } from "@/components/ui/skeleton";
import { PublicHeader } from "@/components/venue/public-header";
import { PublicCardSkeletonGrid } from "@/components/venue/public-card-skeleton";
import type { LayoutItem } from "@/components/venue/public-card-renderer";

type Props = {
  /** Estilo da página definido pelo super admin. */
  pageStyle?: "standard" | "immersive";
  /** Layout de cards configurado, usado na grade de publicações. */
  recordLayout?: LayoutItem[] | null;
};

/** Skeleton do perfil público, espelhando o layout configurado pelo super admin. */
export function OrganizationProfileSkeleton({ pageStyle = "standard", recordLayout }: Props) {
  if (pageStyle === "immersive") return <ImmersiveProfileSkeleton recordLayout={recordLayout} />;
  return <StandardProfileSkeleton recordLayout={recordLayout} />;
}

function BreadcrumbSkeleton() {
  return (
    <div className="border-b border-border/60 bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

function StandardProfileSkeleton({ recordLayout }: { recordLayout?: LayoutItem[] | null }) {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <BreadcrumbSkeleton />
      <header className="border-b border-border/60 bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Skeleton className="h-20 w-20 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2 lg:order-1">
          <section className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          </section>
          <section className="space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </section>
          <section className="space-y-4">
            <Skeleton className="h-5 w-36" />
            <PublicCardSkeletonGrid
              count={6}
              layout={recordLayout}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            />
          </section>
        </div>
        <aside className="space-y-3 lg:order-2">
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </aside>
      </main>
    </div>
  );
}

function ImmersiveProfileSkeleton({ recordLayout }: { recordLayout?: LayoutItem[] | null }) {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <BreadcrumbSkeleton />
      <Skeleton className="h-72 w-full rounded-none sm:h-[26rem]" />
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-8">
          <div className="space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/5" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
          <PublicCardSkeletonGrid
            count={4}
            layout={recordLayout}
            className="grid gap-4 sm:grid-cols-2"
          />
        </div>
        <aside className="space-y-3">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </aside>
      </main>
    </div>
  );
}
