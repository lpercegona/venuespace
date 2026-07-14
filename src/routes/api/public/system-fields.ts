import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/system-fields")({
  server: {
    handlers: {
      GET: async () => {
        const { listAllSystemFieldsPublic } = await import("@/lib/system-fields.functions");
        const data = await listAllSystemFieldsPublic();
        return Response.json(data, {
          headers: { "cache-control": "public, max-age=60, s-maxage=60" },
        });
      },
    },
  },
});
