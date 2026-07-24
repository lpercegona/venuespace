import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PublicCardSkeleton({ withLogo = false }: { withLogo?: boolean }) {
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
  className = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
}: { count?: number; withLogo?: boolean; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <PublicCardSkeleton key={i} withLogo={withLogo} />
      ))}
    </div>
  );
}
