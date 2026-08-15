import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  bookingLabel, dayKey, dealTone, monthDays, monthLabel, monthStart, toISO,
  type CalendarBooking,
} from "./booking-calendar-shared";

const CELL = 34; // largura de cada dia em px

/** Grade de ocupação: uma linha por item reservável, colunas por dia. */
export function BookingTimelineView({
  month,
  onMonthChange,
  bookings,
  onSelect,
}: {
  month: string;
  onMonthChange: (m: string) => void;
  bookings: CalendarBooking[];
  onSelect: (b: CalendarBooking) => void;
}) {
  const days = useMemo(() => monthDays(month), [month]);
  const today = toISO(new Date());

  const rows = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of bookings) {
      const labels = b.items.length > 0 ? b.items.map((i) => i.label || "Sem item") : [bookingLabel(b)];
      for (const label of labels) {
        const list = map.get(label) ?? [];
        list.push(b);
        map.set(label, list);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [bookings]);

  const shift = (delta: number) => {
    const d = monthStart(`${month}-01`);
    d.setMonth(d.getMonth() + delta);
    onMonthChange(toISO(d).slice(0, 7));
  };

  const first = days[0];
  const last = days[days.length - 1];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" aria-label="Mês anterior" onClick={() => shift(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="min-w-0 truncate text-center text-sm font-medium capitalize">{monthLabel(`${month}-01`)}</p>
        <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" aria-label="Próximo mês" onClick={() => shift(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
          Nenhuma reserva neste mês.
        </p>
      ) : (
        <ScrollArea className="w-full rounded-md border border-border">
          <div style={{ minWidth: 180 + days.length * CELL }}>
            <div className="flex border-b border-border bg-muted/40">
              <div className="w-[180px] shrink-0 px-2 py-2 text-xs font-medium text-muted-foreground">Item</div>
              <div className="flex">
                {days.map((d) => (
                  <div
                    key={d}
                    style={{ width: CELL }}
                    className={cn(
                      "shrink-0 py-2 text-center text-[11px] text-muted-foreground",
                      d === today ? "font-semibold text-foreground" : null,
                    )}
                  >
                    {Number(d.slice(8, 10))}
                  </div>
                ))}
              </div>
            </div>

            {rows.map(([label, list]) => (
              <div key={label} className="flex border-b border-border last:border-b-0">
                <div className="w-[180px] shrink-0 truncate px-2 py-3 text-sm" title={label}>{label}</div>
                <div className="relative flex" style={{ height: 44 }}>
                  {days.map((d) => (
                    <div key={d} style={{ width: CELL }} className="h-full shrink-0 border-l border-border/50" />
                  ))}
                  {list.map((b) => {
                    const s = dayKey(b.start);
                    const e = dayKey(b.end) ?? s;
                    if (!s || !e || e < first || s > last) return null;
                    const from = s < first ? first : s;
                    const to = e > last ? last : e;
                    const startIdx = days.indexOf(from);
                    const span = days.indexOf(to) - startIdx + 1;
                    if (startIdx < 0 || span <= 0) return null;
                    return (
                      <button
                        key={`${b.id}-${label}`}
                        type="button"
                        onClick={() => onSelect(b)}
                        title={`${bookingLabel(b)} · ${s} → ${e}`}
                        style={{ left: startIdx * CELL + 2, width: span * CELL - 4 }}
                        className={cn(
                          "absolute top-1/2 h-7 -translate-y-1/2 truncate rounded-sm border-l-4 px-1 text-left text-[11px] outline-hidden focus-visible:ring-3 focus-visible:ring-ring",
                          dealTone(b.deal_status).bar,
                          b.status === "archived" ? "opacity-60" : null,
                        )}
                      >
                        {bookingLabel(b)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
