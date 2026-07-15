import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/viacep/$cep")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const cep = String(params.cep ?? "").replace(/\D/g, "");
        if (cep.length !== 8) return Response.json({ error: "CEP inválido" }, { status: 400 });
        try {
          const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          if (!res.ok) return Response.json({ error: "Falha ViaCEP" }, { status: 502 });
          const body = await res.json();
          if ((body as any)?.erro) return Response.json({ error: "CEP não encontrado" }, { status: 404 });
          return new Response(JSON.stringify(body), {
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=86400, s-maxage=86400",
            },
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
