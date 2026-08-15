import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bookingLabel, dealTone, monthDays, monthLabel, monthStart, occupiesDay, toISO,
  type CalendarBooking,
} from "./booking-calendar-shared";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Visualização mensal das reservas. */
export function BookingCalendarView({
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
  const leading = useMemo(() => monthStart(`${month}-01`).getDay(), [month]);
  const today = toISO(new Date());

  const shift = (delta: number) => {
    const d = monthStart(`${month}-01`);
    d.setMonth(d.getMonth() + delta);
    onMonthChange(toISO(d).slice(0, 7));
  };

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

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leading }).map((_, i) => (
          <div key={`lead-${i}`} className="min-h-20 rounded-md border border-dashed border-border/60" />
        ))}
        {days.map((day) => {
          const dayBookings = bookings.filter((b) => occupiesDay(b, day));
          return (
            <div
              key={day}
              className={cn(
                "min-h-20 rounded-md border border-border p-1 text-left",
                day === today ? "ring-3 ring-ring/40" : null,
              )}
            >
              <p className="px-1 text-xs text-muted-foreground">{Number(day.slice(8, 10))}</p>
              <ul className="mt-1 space-y-1">
                {dayBookings.slice(0, 3).map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(b)}
                      title={bookingLabel(b)}
                      className={cn(
                        "block w-full truncate rounded-sm border-l-4 px-1 py-0.5 text-left text-[11px] outline-hidden focus-visible:ring-3 focus-visible:ring-ring",
                        dealTone(b.deal_status).bar,
                        b.status === "archived" ? "opacity-60" : null,
                      )}
                    >
                      {bookingLabel(b)}
                    </button>
                  </li>
                ))}
                {dayBookings.length > 3 ? (
                  <li className="px-1 text-[11px] text-muted-foreground">+{dayBookings.length - 3}</li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
