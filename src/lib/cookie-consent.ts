/** Estado e persistência do consentimento de cookies (LGPD). */

export const CONSENT_STORAGE_KEY = "vs_cookie_consent";
export const CONSENT_VERSION = 1;
/** Validade do consentimento: 12 meses. */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export type ConsentCategories = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export type ConsentRecord = {
  version: number;
  savedAt: string;
  categories: ConsentCategories;
};

export const DENY_ALL: ConsentCategories = { necessary: true, analytics: false, marketing: false };
export const ALLOW_ALL: ConsentCategories = { necessary: true, analytics: true, marketing: true };

export function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed?.version !== CONSENT_VERSION) return null;
    const saved = Date.parse(parsed.savedAt);
    if (!Number.isFinite(saved) || Date.now() - saved > CONSENT_MAX_AGE_MS) return null;
    return {
      version: CONSENT_VERSION,
      savedAt: parsed.savedAt,
      categories: {
        necessary: true,
        analytics: !!parsed.categories?.analytics,
        marketing: !!parsed.categories?.marketing,
      },
    };
  } catch {
    return null;
  }
}

export function writeConsent(categories: ConsentCategories): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    savedAt: new Date().toISOString(),
    categories: { ...categories, necessary: true },
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* armazenamento indisponível */
  }
  applyConsentToGtm(record.categories);
  return record;
}

/** Envia o estado escolhido ao Google Consent Mode v2. */
export function applyConsentToGtm(categories: ConsentCategories) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  // gtag usa `arguments`, por isso o push do array bruto.
  w.dataLayer.push([
    "consent",
    "update",
    {
      ad_storage: categories.marketing ? "granted" : "denied",
      ad_user_data: categories.marketing ? "granted" : "denied",
      ad_personalization: categories.marketing ? "granted" : "denied",
      analytics_storage: categories.analytics ? "granted" : "denied",
      functionality_storage: "granted",
      personalization_storage: categories.marketing ? "granted" : "denied",
      security_storage: "granted",
    },
  ]);
  w.dataLayer.push({ event: "cookie_consent_update" });
}

/** Evento global para reabrir o painel de preferências a partir do rodapé. */
export const OPEN_PREFERENCES_EVENT = "vs:open-cookie-preferences";

export function openCookiePreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_PREFERENCES_EVENT));
}
