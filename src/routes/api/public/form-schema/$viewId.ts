import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/form-schema/$viewId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { loadPublicFormSchema } = await import("@/lib/public.server");
        try {
          const { view, fields } = await loadPublicFormSchema(params.viewId);
          return Response.json({ view, fields });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 404 });
        }
      },
    },
  },
});
