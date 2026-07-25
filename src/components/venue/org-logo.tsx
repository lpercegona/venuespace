import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { LazyImage } from "@/components/venue/lazy-image";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
};

function isHttp(v: string) {
  return /^https?:\/\//i.test(v);
}

export function OrgLogo({ src, alt, className, iconClassName }: Props) {
  const base = "shrink-0 rounded-md border border-border bg-muted/40 flex items-center justify-center overflow-hidden";
  const [resolved, setResolved] = useState<string | null>(() => (src && isHttp(src) ? src : null));

  useEffect(() => {
    let alive = true;
    if (!src) { setResolved(null); return; }
    if (isHttp(src)) { setResolved(src); return; }
    setResolved(null);
    supabase.storage
      .from("venue-uploads")
      .createSignedUrl(src, 60 * 60)
      .then(({ data }) => { if (alive && data?.signedUrl) setResolved(data.signedUrl); })
      .catch(() => {});
    return () => { alive = false; };
  }, [src]);

  if (resolved) {
    return (
      <LazyImage
        src={resolved}
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
