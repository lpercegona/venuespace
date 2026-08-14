import { createFileRoute } from "@tanstack/react-router";

/**
 * Entrega arquivos do bucket `venue-uploads` por URL estável e cacheável.
 * Evita URLs assinadas expirando (imagens sumindo) e trocando de token
 * (imagens recarregando/piscando a cada navegação).
 */
/** Prefixos privados que nunca podem ser servidos publicamente. */
const PRIVATE_PREFIXES = ["orcamentos/"];

/** Extensões permitidas: apenas conteúdo de imagem público. */
const ALLOWED_EXT = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

export const Route = createFileRoute("/api/public/img/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = (params as { _splat?: string })._splat ?? "";
        const path = decodeURIComponent(raw).replace(/^\/+/, "");
        if (!path || path.includes("..") || path.startsWith(".")) {
          return new Response("Not found", { status: 404 });
        }
        const lower = path.toLowerCase();
        if (PRIVATE_PREFIXES.some((p) => lower.startsWith(p)) || !ALLOWED_EXT.test(lower)) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("venue-uploads").download(path);
        if (error || !data) return new Response("Not found", { status: 404 });
        const buffer = await data.arrayBuffer();
        return new Response(buffer, {
          headers: {
            "content-type": data.type || "application/octet-stream",
            "content-length": String(buffer.byteLength),
            "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable",
          },
        });
      },
    },
  },
});
