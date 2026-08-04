"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Loader2, User, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/venue/empty-state";
import {
  getOrganizationReviews,
  getMyOrganizationReview,
  upsertMyOrganizationReview,
} from "@/lib/reviews.functions";

function StarRating({ value, onChange, size = "md" }: { value: number; onChange?: (n: number) => void; size?: "sm" | "md" | "lg" }) {
  const [hover, setHover] = useState(0);
  const cls = size === "lg" ? "h-8 w-8" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          aria-label={`${n} estrelas`}
          className="p-0.5 disabled:cursor-default"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => setHover(n)}
        >
          <Star
            className={`${cls} ${n <= (hover || value) ? "fill-warning text-warning" : "text-muted-foreground"} transition-colors`}
          />
        </button>
      ))}
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { year: "numeric", month: "short", day: "numeric" });
}

export function OrganizationReviews({
  organizationId,
  avgRating,
  totalReviews,
}: {
  organizationId: string;
  avgRating: number | null;
  totalReviews: number;
}) {
  const qc = useQueryClient();
  const reviewsQ = useQuery({
    queryKey: ["org-reviews", organizationId],
    queryFn: () => getOrganizationReviews({ data: { organization_id: organizationId } }),
  });
  const mineQ = useQuery({
    queryKey: ["my-org-review", organizationId],
    queryFn: () => getMyOrganizationReview({ data: { organization_id: organizationId } }),
  });

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const items = (reviewsQ.data?.items ?? []) as Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    user?: { display_name?: string | null } | null;
  }>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast.error("Escolha uma nota de 1 a 5 estrelas.");
      return;
    }
    setSaving(true);
    try {
      await upsertMyOrganizationReview({
        data: { organization_id: organizationId, rating, comment: comment || undefined },
      });
      toast.success("Avaliação enviada. Ela será exibida após moderação.");
      setEditing(false);
      setComment("");
      setRating(0);
      await qc.invalidateQueries({ queryKey: ["org-reviews", organizationId] });
      await qc.invalidateQueries({ queryKey: ["my-org-review", organizationId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-lg font-semibold">Avaliações</h2>
        {totalReviews > 0 && avgRating != null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4 fill-warning text-warning" />
            <span className="font-semibold text-foreground">{avgRating.toFixed(1).replace(".", ",")}</span>
            <span>({totalReviews} avaliação{totalReviews === 1 ? "" : "s"})</span>
          </div>
        ) : null}
      </div>

      {reviewsQ.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : items.length === 0 && !editing ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title="Sem avaliações ainda"
          description="Seja o primeiro a avaliar esta organização."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="flex items-start gap-3 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{r.user?.display_name || "Usuário"}</span>
                      <StarRating value={r.rating} size="sm" />
                      <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                    </div>
                    {r.comment ? <p className="mt-2 text-sm text-foreground/90">{r.comment}</p> : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {mineQ.isLoading ? null : editing ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="font-medium text-foreground">Deixe sua avaliação</p>
          <StarRating value={rating} onChange={setRating} size="lg" />
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte sua experiência (opcional)"
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || rating < 1}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar avaliação"}
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={() => setEditing(true)}>
          <Star className="h-4 w-4" /> Avaliar organização
        </Button>
      )}
    </section>
  );
}
