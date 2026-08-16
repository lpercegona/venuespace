import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

function toPascal(name: string) {
  return name.split(/[-_\s]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

/** Resolve um nome de ícone lucide (kebab, snake ou pascal) para o componente. */
export function resolveLucide(name: string | null | undefined): LucideIcon | null {
  if (!name) return null;
  const M = LucideIcons as any;
  return (M[name] ?? M[toPascal(name)] ?? M[name.charAt(0).toUpperCase() + name.slice(1)] ?? null) as LucideIcon | null;
}

/** Renderiza um ícone lucide pelo nome; `fallback` é usado quando o nome é vazio/inválido. */
export function IconByName({
  name,
  className,
  fallback,
}: {
  name: string | null | undefined;
  className?: string;
  fallback?: LucideIcon;
}) {
  const Cmp = resolveLucide(name) ?? fallback ?? null;
  if (!Cmp) return null;
  return <Cmp className={className ?? "h-4 w-4 shrink-0"} />;
}
