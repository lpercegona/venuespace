import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { LazyImage } from "@/components/venue/lazy-image";

type Props = {
  urls: string[];
  alt: string;
  aspectClassName?: string;
  className?: string;
  /** Rounding applied to each slide/image. Use "" for bleed (edge-to-edge) cells. */
  roundedClassName?: string;
};

const ARROW_CLS =
  "opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/carousel:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100";

/** Keeps carousel interaction from triggering a wrapping <Link>. */
function stop(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

export function GalleryCarousel({
  urls,
  alt,
  aspectClassName = "aspect-video",
  className,
  roundedClassName = "rounded-md",
}: Props) {
  if (!urls || urls.length === 0) return null;
  if (urls.length === 1) {
    return (
      <LazyImage
        src={urls[0]}
        alt={alt}
        containerClassName={`${aspectClassName} w-full ${roundedClassName} ${className ?? ""}`.trim()}
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <div
      className={`group/carousel relative w-full ${className ?? ""}`.trim()}
      onClick={stop}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <Carousel opts={{ loop: true }} className="relative w-full">
        <CarouselContent>
          {urls.map((u, i) => (
            <CarouselItem key={i}>
              <LazyImage
                src={u}
                alt={`${alt} ${i + 1}`}
                containerClassName={`${aspectClassName} w-full ${roundedClassName}`.trim()}
                className="h-full w-full object-cover"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious type="button" className={`left-2 ${ARROW_CLS}`} />
        <CarouselNext type="button" className={`right-2 ${ARROW_CLS}`} />
        <div className={`pointer-events-none absolute bottom-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur ${ARROW_CLS}`}>
          {urls.length}
        </div>
      </Carousel>
    </div>
  );
}
