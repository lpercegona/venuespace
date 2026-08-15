/** Utilidades compartilhadas pelas visualizações de calendário de reservas. */

export type CalendarBooking = {
  id: string;
  start: string | null;
  end: string | null;
  resource_label: string | null;
  items: Array<{ label: string }>;
  deal_status: string;
  status: string;
};

export function dayKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function monthStart(iso: string): Date {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1);
}

export function monthLabel(iso: string): string {
  const d = monthStart(iso);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function shiftMonth(iso: string, delta: number): string {
  const d = monthStart(iso);
  d.setMonth(d.getMonth() + delta);
  return toISO(d).slice(0, 7);
}

export function currentMonth(): string {
  return toISO(new Date()).slice(0, 7);
}

/** Todos os dias do mês (YYYY-MM). */
export function monthDays(month: string): string[] {
  const start = monthStart(`${month}-01`);
  const days: string[] = [];
  const m = start.getMonth();
  const cur = new Date(start);
  while (cur.getMonth() === m) {
    days.push(toISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** Uma reserva ocupa o dia informado? */
export function occupiesDay(b: CalendarBooking, day: string): boolean {
  const s = dayKey(b.start);
  const e = dayKey(b.end) ?? s;
  if (!s || !e) return false;
  return day >= s && day <= e;
}

export function bookingLabel(b: CalendarBooking): string {
  return b.resource_label ?? "Reserva";
}

/** Classe de cor semântica por estágio de negociação. */
export function dealTone(dealStatus: string): { bar: string; dot: string } {
  switch (dealStatus) {
    case "accepted":
      return { bar: "border-status-accepted bg-status-accepted/15", dot: "bg-status-accepted" };
    case "closed":
      return { bar: "border-status-closed bg-status-closed/15", dot: "bg-status-closed" };
    case "declined":
      return { bar: "border-status-declined bg-status-declined/15", dot: "bg-status-declined" };
    case "negotiating":
      return { bar: "border-status-negotiating bg-status-negotiating/15", dot: "bg-status-negotiating" };
    default:
      return { bar: "border-border bg-muted", dot: "bg-muted-foreground" };
  }
}
