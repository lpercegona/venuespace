import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { LazyImage } from "@/components/venue/lazy-image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Props = {
  urls: string[];
  alt: string;
  aspectClassName?: string;
  className?: string;
  /** Rounding applied to each slide/image. Use "" for bleed (edge-to-edge) cells. */
  roundedClassName?: string;
  /** When true, the carousel fills its nearest positioned ancestor (use with absolute inset-0). */
  fillContainer?: boolean;
  /** Responsive width of each slide (Tailwind basis-*). Defaults to one slide per view. */
  itemBasisClassName?: string;
  /** How many images to eagerly preload (default 5). */
  preloadCount?: number;
  /** Shows the "1/5" slide counter (default true). */
  showCounter?: boolean;
  /** Abre a imagem em lightbox ao clicar (usado nas páginas de perfil). */
  enableLightbox?: boolean;
};

const REVEAL_CLS =
  "opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/carousel:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100";

const GLASS_CLS = "bg-background/30 backdrop-blur-md border-white/25 text-white hover:bg-background/45 hover:text-white";

const ARROW_CLS = `z-30 ${REVEAL_CLS} ${GLASS_CLS}`;

/** Keeps arrow interaction from triggering the wrapping <Link>. */
function stopNav(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export function GalleryCarousel({
  urls,
  alt,
  aspectClassName = "aspect-video",
  className,
  roundedClassName = "rounded-md",
  fillContainer,
  itemBasisClassName,
  preloadCount = 5,
  showCounter = true,
  enableLightbox = false,
}: Props) {
  const [api, setApi] = useState<CarouselApi>();
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  if (!urls || urls.length === 0) return null;
  const fillCls = fillContainer ? "h-full w-full" : `${aspectClassName} w-full`;
  if (urls.length === 1) {
    return (
      <>
        <LazyImage
          src={urls[0]}
          alt={alt}
          onClick={enableLightbox ? (e) => { stopNav(e); setLightbox(urls[0]!); } : undefined}
          containerClassName={`${fillCls} ${roundedClassName} ${className ?? ""} ${enableLightbox ? "cursor-zoom-in" : ""}`.trim()}
          className="h-full w-full object-cover object-center"
        />
        <ImageLightbox src={lightbox} alt={alt} onClose={() => setLightbox(null)} />
      </>
    );
  }

  const total = urls.length;
  const nextIdx = (index + 1) % total;
  const prevIdx = (index - 1 + total) % total;
  // Pré-carrega as primeiras imagens visíveis (padrão 5), anterior e próximas.
  const eagerSet = new Set<number>();
  eagerSet.add(index);
  eagerSet.add(prevIdx);
  for (let step = 1; eagerSet.size < Math.min(preloadCount, total); step++) {
    eagerSet.add((index + step) % total);
  }

  return (
    <div className={`group/carousel relative ${fillContainer ? "h-full w-full" : "w-full"} ${className ?? ""}`.trim()} role="presentation">
      <Carousel opts={{ loop: true }} setApi={setApi} className={`relative ${fillContainer ? "h-full w-full [&>div:first-child]:h-full" : "w-full"}`}>
        <CarouselContent className={`ml-0 ${fillContainer ? "h-full" : ""}`}>
          {urls.map((u, i) => {
            const eager = eagerSet.has(i);
            return (
              <CarouselItem key={i} className={`pl-0 ${itemBasisClassName ?? ""} ${fillContainer ? "h-full" : ""}`.trim()}>
                <LazyImage
                  src={u}
                  alt={`${alt} ${i + 1}`}
                  onClick={enableLightbox ? (e) => { stopNav(e); setLightbox(u); } : undefined}
                  loading={eager ? "eager" : "lazy"}
                  fetchPriority={i === nextIdx ? "high" : undefined}
                  containerClassName={`${fillCls} ${roundedClassName} ${enableLightbox ? "cursor-zoom-in" : ""}`.trim()}
                  className="h-full w-full object-cover object-center"
                />
              </CarouselItem>
            );
          })}
        </CarouselContent>


        {/* Somente as setas interceptam o clique; o restante do card navega. */}
        <span onClick={stopNav} onPointerDown={(e) => e.stopPropagation()} role="presentation">
          <CarouselPrevious type="button" className={`left-2 ${ARROW_CLS}`} />
        </span>
        <span onClick={stopNav} onPointerDown={(e) => e.stopPropagation()} role="presentation">
          <CarouselNext type="button" className={`right-2 ${ARROW_CLS}`} />
        </span>
      </Carousel>

      {showCounter ? (
        <div
          className={`pointer-events-none absolute bottom-2 right-2 z-30 h-fit w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm ${GLASS_CLS} ${REVEAL_CLS}`}
        >
          {index + 1}/{total}
        </div>
      ) : null}

      <ImageLightbox src={lightbox} alt={alt} onClose={() => setLightbox(null)} />
    </div>
  );
}

function ImageLightbox({ src, alt, onClose }: { src: string | null; alt: string; onClose: () => void }) {
  return (
    <Dialog open={!!src} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        {src ? (
          <img src={src} alt={alt} className="max-h-[85vh] w-full rounded-lg object-contain" />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
