import { Link } from "@tanstack/react-router";
import { openCookiePreferences } from "@/lib/cookie-consent";

const footerGroups = [
  {
    title: "Empresa",
    links: [
      { to: "/para-empresas", label: "Para empresas" },
      { to: "/blog", label: "Blog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/termos-e-condicoes", label: "Termos e condições" },
      { to: "/politica-de-privacidade", label: "Política de Privacidade" },
      { to: "/contestacao-de-espacos", label: "Contestações de espaços" },
    ],
  },
  {
    title: "Ferramentas",
    links: [
      { to: "https://tools.venuespace.com.br", label: "Ferramentas", external: true },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {/* Colunas */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-foreground">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.links.map((link) => {
                  const isExternal = link.external || link.to.startsWith("http");
                  return (
                    <li key={link.to}>
                      {isExternal ? (
                        <a
                          href={link.to}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          to={link.to}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Copyright com preferências de cookies */}
        <div className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground flex flex-col sm:flex-row items-center justify-center gap-2">
          <span>
            {new Date().getFullYear()} VENUESPACE — feito com{" "}
            <span className="inline-block rotate-45">♥</span>
          </span>
          <span className="hidden sm:inline-block text-border">·</span>
          <button
            type="button"
            onClick={() => openCookiePreferences()}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Preferências de cookies
          </button>
        </div>
      </div>
    </footer>
  );
}
