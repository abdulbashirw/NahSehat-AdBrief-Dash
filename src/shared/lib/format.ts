/**
 * Locale-aware number, currency, percent and date formatting.
 *
 * All formatters read the current language from i18next and use the
 * appropriate locale (id-ID or en-US).  Import the hooks or the raw
 * functions — hooks re-render on language change, raw functions use
 * the current language at call-time.
 */
import { langToLocale, type LangCode, DEFAULT_LANG } from '@/shared/i18n/i18n';

// ── Current language resolver ────────────────────────────────────────
// We import i18n lazily so format.ts can be used at module level
// before i18n is fully initialised (e.g. in store slices).
let _currentLang: LangCode = DEFAULT_LANG;

/** Called by LanguageProvider whenever the language changes. */
export function _setFormatLang(lang: LangCode) {
  _currentLang = lang;
}

/** Resolve the locale string for the current language. */
function locale(): string {
  return langToLocale(_currentLang);
}

// ── Formatters ───────────────────────────────────────────────────────

/** 18085965706 -> "18.085.965.706" (id) / "18,085,965,706" (en) */
export function formatIDR(n: number): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** Grouped integer: 6386 -> "6.386" (id) / "6,386" (en) */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(Math.round(n));
}

/** n is in percent units: 97.87 -> "97,87%" (id) / "97.87%" (en) */
export function formatPct(n: number): string {
  return `${new Intl.NumberFormat(locale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}%`;
}

/** Ratio -> percent string: 0.9787 -> "97,87%" (id) / "97.87%" (en) */
export function formatRatioPct(ratio: number): string {
  return formatPct(ratio * 100);
}

/** Locale-aware month abbreviations. */
const MONTHS: Record<string, string[]> = {
  'id-ID': ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  'en-US': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

function months(): string[] {
  return MONTHS[locale()] ?? MONTHS['en-US'];
}

/** Compact IDR for chart axes: 18085965706 -> "18,1 M" (id) / "18.1B" (en) */
export function formatCompactIDR(n: number): string {
  const abs = Math.abs(n);
  const one = new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 });
  if (abs >= 1e9) {
    const suffix = _currentLang === 'en' ? 'B' : 'M';
    return `${one.format(n / 1e9)} ${suffix}`;
  }
  if (abs >= 1e6) {
    const suffix = _currentLang === 'en' ? 'M' : 'jt';
    return `${one.format(n / 1e6)} ${suffix}`;
  }
  if (abs >= 1e3) {
    const suffix = _currentLang === 'en' ? 'K' : 'rb';
    return `${one.format(n / 1e3)} ${suffix}`;
  }
  return `${Math.round(n)}`;
}

/** "17012025" -> Date(2025-01-17). Returns null for empty/invalid input. */
export function parseDDMMYYYY(s: string | null | undefined): Date | null {
  if (!s || s.length < 8) return null;
  const dd = Number(s.slice(0, 2));
  const mm = Number(s.slice(2, 4));
  const yyyy = Number(s.slice(4, 8));
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
}

/** Date -> "17 Jan 2025" (locale-aware month abbreviation) */
export function formatDate(d: Date): string {
  return `${d.getDate()} ${months()[d.getMonth()]} ${d.getFullYear()}`;
}

/** Date -> "17 Jan 2025, 14:32" (locale-aware) */
export function formatDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)}, ${hh}:${mi}`;
}

/** Date -> "Jul 2025" (locale-aware) */
export function formatMonthShort(d: Date): string {
  return `${months()[d.getMonth()]} ${d.getFullYear()}`;
}

/** Decimal number: 1234.5 -> "1.234,5" (id) / "1,234.5" (en) */
export function formatDecimal(n: number, minFrac = 1, maxFrac = 1): string {
  return new Intl.NumberFormat(locale(), {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  }).format(n);
}

/** CSV separator — semicolon for id-ID (comma = decimal mark), comma for en-US */
export function csvSeparator(): string {
  return _currentLang === 'en' ? ',' : ';';
}