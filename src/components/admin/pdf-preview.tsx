import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

type Props = { base64: string | null; loading?: boolean };

/** Renderiza o PDF de amostra com pdf.js — carregado sob demanda no admin. */
export function PdfPreview({ base64, loading }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host || !base64) return;

    (async () => {
      try {
        const pdfjs: any = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = (
          await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
        ).default;
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const doc = await pdfjs.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        host.replaceChildren();
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 1.25 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "w-full rounded-md border border-border bg-card shadow-elegant";
          host.append(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
        }
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [base64]);

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando pré-visualização…
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div ref={hostRef} className="space-y-3" />
      {!base64 && !loading ? (
        <p className="text-xs text-muted-foreground">Selecione uma categoria para ver o modelo.</p>
      ) : null}
    </div>
  );
}
