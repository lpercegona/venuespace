import { cn } from "@/lib/utils";
import { toRichTextHtml } from "@/lib/rich-text";

/** Renderiza descrição rica (texto, título H4 e bullets) já sanitizada. */
export function RichTextView({ value, className }: { value: string | null | undefined; className?: string }) {
  const html = toRichTextHtml(value ?? "");
  if (!html) return null;
  return (
    <div
      className={cn(
        "text-sm leading-relaxed text-foreground/90",
        "[&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:font-display [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-foreground first:[&_h4]:mt-0",
        "[&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
