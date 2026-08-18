/** Indonesian-locale (id-ID) number, currency, percent and date formatting. */

const idNumber = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const idPercent = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** 18085965706 -> "18.085.965.706" */
export function formatIDR(n: number): string {
  return idNumber.format(Math.round(n));
}

/** Grouped integer, id-ID separators: 6386 -> "6.386" */
export function formatNumber(n: number): string {
  return idNumber.format(Math.round(n));
}

/** n is in percent units: 97.87 -> "97,87%" */
export function formatPct(n: number): string {
  return `${idPercent.format(n)}%`;
}

/** Ratio -> percent string: 0.9787 -> "97,87%" */
export function formatRatioPct(ratio: number): string {
  return formatPct(ratio * 100);
}

/** Compact IDR for chart axes: 18085965706 -> "18,1 M" (miliar), 755400000 -> "755,4 jt" */
export function formatCompactIDR(n: number): string {
  const abs = Math.abs(n);
  const one = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
  if (abs >= 1e9) return `${one.format(n / 1e9)} M`;
  if (abs >= 1e6) return `${one.format(n / 1e6)} jt`;
  if (abs >= 1e3) return `${one.format(n / 1e3)} rb`;
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

/** Date -> "17 Jan 2025" */
export function formatDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Date -> "17 Jan 2025, 14:32" */
export function formatDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)}, ${hh}:${mi}`;
}

/** Date -> "Jul 2025" */
export function formatMonthShort(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
