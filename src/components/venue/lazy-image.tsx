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
    // Imagem já em cache do navegador: `onLoad` pode não disparar após hidratação.
    if (ref.current?.complete && ref.current.naturalWidth > 0) {
      loadedUrls.add(src);
      setLoaded(true);
    } else {
      setLoaded(false);
    }
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
