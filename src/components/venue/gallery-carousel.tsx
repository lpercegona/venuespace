import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

type Props = {
  urls: string[];
  alt: string;
  aspectClassName?: string;
  className?: string;
};

export function GalleryCarousel({ urls, alt, aspectClassName = "aspect-video", className }: Props) {
  if (!urls || urls.length === 0) return null;
  if (urls.length === 1) {
    return (
      <img
        src={urls[0]}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`${aspectClassName} w-full rounded-md object-cover ${className ?? ""}`.trim()}
      />
    );
  }
  return (
    <Carousel opts={{ loop: true }} className={`relative w-full ${className ?? ""}`.trim()}>
      <CarouselContent>
        {urls.map((u, i) => (
          <CarouselItem key={i}>
            <img
              src={u}
              alt={`${alt} ${i + 1}`}
              loading="lazy"
              decoding="async"
              className={`${aspectClassName} w-full rounded-md object-cover`}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-2" />
      <CarouselNext className="right-2" />
      <div className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur">
        {urls.length}
      </div>
    </Carousel>
  );
}
