import { cn } from "@/lib/utils";

export type SegmentedOption = { value: string; label: string };

type Props = {
  value: string;
  onValueChange: (v: string) => void;
  options: SegmentedOption[];
  className?: string;
  ariaLabel?: string;
};

/** Toggle segmentado: trilha clara arredondada com pílula deslizante. */
export function SegmentedToggle({ value, onValueChange, options, className, ariaLabel }: Props) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 shadow-elegant",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(o.value)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors outline-hidden focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "bg-primary text-primary-foreground shadow-elegant"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
