import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  containerClassName?: string;
};

/**
 * Registro das URLs já exibidas nesta sessão: ao remontar (navegação, troca de
 * filtro, re-render), a imagem aparece imediatamente em vez de piscar o skeleton.
 */
const loadedUrls = new Set<string>();

export function LazyImage({ containerClassName, className, onLoad, onError, ...img }: Props) {
  const src = typeof img.src === "string" ? img.src : undefined;
  const [loaded, setLoaded] = useState(() => (src ? loadedUrls.has(src) : false));
  const [errored, setErrored] = useState(false);
  const ref = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) return;
    if (loadedUrls.has(src)) { setLoaded(true); setErrored(false); return; }
    setErrored(false);
    let alive = true;
    const check = () => {
      const el = ref.current;
      if (!alive || !el) return false;
      if (el.complete && el.naturalWidth > 0) {
        loadedUrls.add(src);
        setLoaded(true);
        return true;
      }
      return false;
    };
    // Imagem já carregada antes da hidratação: o evento `load` não é capturado
    // pelo React, então verificamos o estado nativo por alguns ciclos.
    if (!check()) {
      setLoaded(false);
      const id = window.setInterval(() => { if (check()) window.clearInterval(id); }, 200);
      window.setTimeout(() => window.clearInterval(id), 15000);
      return () => { alive = false; window.clearInterval(id); };
    }
    return () => { alive = false; };
  }, [src]);


  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {!loaded && !errored ? (
        <Skeleton className="absolute inset-0 h-full w-full rounded-[inherit]" />
      ) : null}
      <img
        {...img}
        ref={ref}
        loading={img.loading ?? "lazy"}
        decoding={img.decoding ?? "async"}
        onLoad={(e) => {
          if (src) loadedUrls.add(src);
          setLoaded(true);
          onLoad?.(e);
        }}
        onError={(e) => { setErrored(true); onError?.(e); }}
        className={cn(
          loaded ? "opacity-100" : "opacity-0 transition-opacity duration-500",
          className,
        )}
      />
    </div>
  );
}
