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
      { to: "/politica-de-cookies", label: "Política de Cookies" },
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
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        {/* Colunas */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground">
                {group.title}
              </h3>
              <ul className="space-y-2">
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

          {/* Coluna extra para Preferências de Cookies (opcional, pode ficar no final) */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground">
              Preferências
            </h3>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => openCookiePreferences()}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Preferências de cookies
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center text-sm text-muted-foreground">
          {new Date().getFullYear()} VENUESPACE — feito com <span className="rotate-45">♥</span>.
        </div>
      </div>
    </footer>
  );
}
