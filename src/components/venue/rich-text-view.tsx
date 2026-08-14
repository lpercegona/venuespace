import { cn } from "@/lib/utils";
import { toRichTextHtml } from "@/lib/rich-text";

/** Renderiza descrição rica (títulos, listas, ênfase e links) já sanitizada. */
export function RichTextView({ value, className }: { value: string | null | undefined; className?: string }) {
  const html = toRichTextHtml(value ?? "");
  if (!html) return null;
  return (
    <div
      className={cn("rich-content text-sm text-foreground/90", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
