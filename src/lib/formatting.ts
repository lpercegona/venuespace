import type { CurrencyDisplay, InstanceSettings } from "./instance-settings.functions";

export type FormatContext = {
  timezone: string;
  currency: string;
  currency_display: CurrencyDisplay;
};

const DEFAULT_CTX: FormatContext = {
  timezone: "America/Sao_Paulo",
  currency: "BRL",
  currency_display: { symbol: "R$", position: "before", decimal: ",", thousand: "." },
};

/** Merge org-level overrides on top of instance defaults. */
export function resolveContext(
  instance: InstanceSettings | null | undefined,
  org?: { timezone?: string | null; currency?: string | null; currency_display?: CurrencyDisplay | null } | null,
): FormatContext {
  const base: FormatContext = instance
    ? {
        timezone: instance.default_timezone,
        currency: instance.default_currency,
        currency_display: instance.currency_display,
      }
    : DEFAULT_CTX;
  if (!org) return base;
  return {
    timezone: org.timezone ?? base.timezone,
    currency: org.currency ?? base.currency,
    currency_display: org.currency_display ?? base.currency_display,
  };
}

export function formatCurrency(value: number | string | null | undefined, ctx: FormatContext): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n == null || Number.isNaN(n)) return "";
  const abs = Math.abs(n);
  const [intPart, decPart] = abs.toFixed(2).split(".");
  const withThousand = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ctx.currency_display.thousand);
  const body = `${withThousand}${ctx.currency_display.decimal}${decPart}`;
  const signed = n < 0 ? `-${body}` : body;
  return ctx.currency_display.position === "before"
    ? `${ctx.currency_display.symbol} ${signed}`
    : `${signed} ${ctx.currency_display.symbol}`;
}

export function formatDateTime(iso: string | Date | null | undefined, ctx: FormatContext): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: ctx.timezone,
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function formatDate(iso: string | Date | null | undefined, ctx: FormatContext): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: ctx.timezone,
      dateStyle: "short",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatTime(iso: string | Date | null | undefined, ctx: FormatContext): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: ctx.timezone,
      timeStyle: "short",
    }).format(d);
  } catch {
    return "";
  }
}
