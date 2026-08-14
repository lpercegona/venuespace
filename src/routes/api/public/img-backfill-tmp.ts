// TEMPORÁRIO: usado apenas para o backfill único de otimização de imagens.
// Este arquivo é removido logo após a execução.
import { createFileRoute } from "@tanstack/react-router";

const TOKEN = "vs-backfill-2026-08-14-8f3a2c";
const BUCKET = "venue-uploads";

async function listAll(admin: any, prefix: string, out: string[]) {
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, offset });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || item.metadata == null) {
        await listAll(admin, full, out);
      } else {
        out.push(full);
      }
    }
    if (data.length < 100) break;
    offset += data.length;
  }
}

export const Route = createFileRoute("/api/public/img-backfill-tmp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("token") !== TOKEN) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const paths: string[] = [];
        await listAll(supabaseAdmin, "", paths);
        const images = paths.filter((p) => /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(p));
        const { data, error } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrls(images, 60 * 60 * 4);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ count: images.length, files: data });
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          token?: string;
          path?: string;
          base64?: string;
          contentType?: string;
        };
        if (body.token !== TOKEN) return new Response("Unauthorized", { status: 401 });
        if (!body.path || !body.base64) return new Response("Bad request", { status: 400 });
        const bin = Uint8Array.from(atob(body.base64), (c) => c.charCodeAt(0));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(body.path, bin, {
            upsert: true,
            contentType: body.contentType ?? "image/webp",
          });
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true, size: bin.byteLength });
      },
    },
  },
});
