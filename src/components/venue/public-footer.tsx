import { Link } from "@tanstack/react-router";
import { openCookiePreferences } from "@/lib/cookie-consent";

const links = [
  { to: "/termos-e-condicoes", label: "Termos e condições" },
  { to: "/politica-de-privacidade", label: "Política de Privacidade" },
  { to: "/politica-de-cookies", label: "Política de Cookies" },
  { to: "/contestacao-de-espacos", label: "Contestações de espaços" },
  { to: "https://tools.venuespace.com.br", label: "Ferramentas", external: true },
  { to: "/blog", label: "Blog" },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="shrink-0">© {new Date().getFullYear()} VENUESPACE</span>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => openCookiePreferences()}
            className="hover:text-foreground"
          >
            Preferências de cookies
          </button>
        </nav>
      </div>
    </footer>
  );
}
