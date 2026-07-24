import { Building2 } from "lucide-react";
import { LazyImage } from "@/components/venue/lazy-image";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
};

export function OrgLogo({ src, alt, className, iconClassName }: Props) {
  const base = "shrink-0 rounded-md border border-border bg-muted/40 flex items-center justify-center overflow-hidden";
  if (src && /^https?:\/\//i.test(src)) {
    return (
      <LazyImage
        src={src}
        alt={alt}
        containerClassName={cn(base, className)}
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <div className={cn(base, className)} aria-label={alt} role="img">
      <Building2 className={cn("h-1/2 w-1/2 text-muted-foreground", iconClassName)} />
    </div>
  );
}
