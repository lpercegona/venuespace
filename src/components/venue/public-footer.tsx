import { Link } from "@tanstack/react-router";

export function PublicFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
        <span>© {new Date().getFullYear()} VENUESPACE</span>
        <Link to="/blog" className="hover:text-foreground">
          Blog
        </Link>
      </div>
    </footer>
  );
}
