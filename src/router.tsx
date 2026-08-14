import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  // Desidrata o cache das queries carregadas no servidor para o cliente:
  // evita divergência de hidratação (servidor com dados x cliente em loading)
  // e elimina o refetch duplicado no primeiro carregamento.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
};
