import { Link } from "@tanstack/react-router";

const links = [
  { to: "/termos-e-condicoes", label: "Termos e condições" },
  { to: "/politica-de-privacidade", label: "Política de Privacidade" },
  { to: "/contestacao-de-espacos", label: "Contestações de espaços" },
  { to: "/tools", label: "Ferramentas" },
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
        </nav>
      </div>
    </footer>
  );
}
