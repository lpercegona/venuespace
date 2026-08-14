import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { PublicHeader, BackLink } from "@/components/venue/public-header";
import { PublicFooter } from "@/components/venue/public-footer";
import { PublicBreadcrumbs } from "@/components/venue/public-breadcrumbs";

import { InterestFormModal } from "@/components/venue/interest-form-modal";

const searchSchema = z.object({
  view: z.string().uuid(),
  record: z.string().uuid().optional(),
});

export const Route = createFileRoute("/public/$slug/$tableId/form")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Manifestar interesse — Venuespace" }, { name: "robots", content: "noindex" }] }),
  component: PublicFormPage,
});

function PublicFormPage() {
  const { slug, tableId } = Route.useParams();
  const { view: viewId, record: recordId } = Route.useSearch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <PublicBreadcrumbs
        items={[
          { label: "Home", to: "/" },
          { label: slug, to: "/public/$slug", params: { slug } },
          { label: "Contato" },
        ]}
      />
      <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <div className="mb-3 flex justify-center">
          <BackLink to="/public/$slug" params={{ slug }} label="Voltar" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Manifestar interesse</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O formulário abre em uma janela sobre esta página.
        </p>
      </main>
      <InterestFormModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) navigate({ to: "/public/$slug/$tableId", params: { slug, tableId } });
        }}
        slug={slug}
        tableId={tableId}
        viewId={viewId}
        recordId={recordId}
      />
      <PublicFooter />
    </div>
  );
}
