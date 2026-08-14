import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
  /** Texto de ajuda. Quando vazio, nenhum ícone é exibido. */
  tooltip?: string | null;
  className?: string;
};

/**
 * Rótulo padrão de formulário: texto + marca de obrigatório + ícone "i"
 * com tooltip, exibido somente quando há texto de ajuda configurado.
 */
export function FieldLabel({ htmlFor, children, required, tooltip, className }: Props) {
  const help = typeof tooltip === "string" ? tooltip.trim() : "";
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {children}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {help ? (
        <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`Ajuda: ${help}`}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-xs">{help}</TooltipContent>
        </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
