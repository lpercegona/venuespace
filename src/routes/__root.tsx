import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Venuespace</p>
        <h1 className="mt-3 font-display text-6xl font-semibold text-foreground">404</h1>
        <h2 className="mt-4 text-lg font-medium text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">Esta página não carregou</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado. Tente recarregar ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Venuespace — espaços para eventos" },
      {
        name: "description",
        content:
          "Liste espaços de eventos, publique ambientes disponíveis, receba interessados e conduza negociações em um só lugar.",
      },
      { name: "author", content: "Venuespace" },
      { property: "og:title", content: "Venuespace — espaços para eventos" },
      {
        property: "og:description",
        content:
          "Liste espaços de eventos, publique ambientes disponíveis, receba interessados e conduza negociações em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Venuespace — espaços para eventos" },
      { name: "twitter:description", content: "Liste espaços de eventos, publique ambientes disponíveis, receba interessados e conduza negociações em um só lugar." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a7f5af82-30fa-411a-8e90-4668ae240b27/id-preview-4690c0bb--0433e389-2dd9-441a-9ff5-ff7f287eeee8.lovable.app-1784241331460.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a7f5af82-30fa-411a-8e90-4668ae240b27/id-preview-4690c0bb--0433e389-2dd9-441a-9ff5-ff7f287eeee8.lovable.app-1784241331460.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        children: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('consent','default',{
            'ad_storage':'denied',
            'ad_user_data':'denied',
            'ad_personalization':'denied',
            'analytics_storage':'denied',
            'personalization_storage':'denied',
            'functionality_storage':'granted',
            'security_storage':'granted',
            'wait_for_update': 500
          });
          try {
            var raw = window.localStorage.getItem('vs_cookie_consent');
            if (raw) {
              var c = JSON.parse(raw);
              var saved = Date.parse(c && c.savedAt);
              if (c && c.version === 1 && saved && (Date.now() - saved) < 365*24*60*60*1000) {
                gtag('consent','update',{
                  'ad_storage': c.categories.marketing ? 'granted' : 'denied',
                  'ad_user_data': c.categories.marketing ? 'granted' : 'denied',
                  'ad_personalization': c.categories.marketing ? 'granted' : 'denied',
                  'analytics_storage': c.categories.analytics ? 'granted' : 'denied',
                  'personalization_storage': c.categories.marketing ? 'granted' : 'denied',
                  'functionality_storage':'granted',
                  'security_storage':'granted'
                });
              }
            }
          } catch (e) {}
        `,
      },
      {
        children: `
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-N6JZNZPB');
        `,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-N6JZNZPB"
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>

        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
