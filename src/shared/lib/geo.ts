/**
 * Province name normalization for the Indonesia choropleth map.
 *
 * The DCSehat API returns STATE values with inconsistent casing
 * ("dki jakarta", "DKI JAKARTA", "DKI Jakarta"). This module maps
 * those variants to the canonical province names used by the SVG
 * `data-province` attributes so the choropleth fills correctly.
 */

/** Normalize a string for matching: uppercase, trim, remove trailing dots. */
function normalize(s: string): string {
  return s.trim().toUpperCase().replace(/\.$/, '').trim();
}

/**
 * Mapping from UPPERCASE province name → canonical SVG province name
 * (matching the `data-province` attributes in indonesia-provinces.svg).
 *
 * Handles the case-inconsistent STATE values returned by the DCSehat API:
 * "dki jakarta", "DKI JAKARTA", "DKI Jakarta" all map to "DKI Jakarta".
 */
const PROVINCE_NAME_MAP: Record<string, string> = {
  ACEH: 'Aceh',
  BALI: 'Bali',
  BANTEN: 'Banten',
  BENGKULU: 'Bengkulu',
  'DI YOGYAKARTA': 'DI Yogyakarta',
  'DAERAH ISTIMEWA YOGYAKARTA': 'DI Yogyakarta',
  YOGYAKARTA: 'DI Yogyakarta',
  'DKI JAKARTA': 'DKI Jakarta',
  'DAERAH KHUSUS IBUKOTA JAKARTA': 'DKI Jakarta',
  JAKARTA: 'DKI Jakarta',
  GORONTALO: 'Gorontalo',
  JAMBI: 'Jambi',
  'JAWA BARAT': 'Jawa Barat',
  'JAWA TENGAH': 'Jawa Tengah',
  'JAWA TIMUR': 'Jawa Timur',
  'KALIMANTAN BARAT': 'Kalimantan Barat',
  'KALIMANTAN SELATAN': 'Kalimantan Selatan',
  'KALIMANTAN TENGAH': 'Kalimantan Tengah',
  'KALIMANTAN TIMUR': 'Kalimantan Timur',
  'KALIMANTAN UTARA': 'Kalimantan Utara',
  'KEPULAUAN BANGKA BELITUNG': 'Kepulauan Bangka Belitung',
  'BANGKA BELITUNG': 'Kepulauan Bangka Belitung',
  'KEPULAUAN RIAU': 'Kepulauan Riau',
  LAMPUNG: 'Lampung',
  'MALUKU UTARA': 'Maluku Utara',
  MALUKU: 'Maluku',
  'NUSA TENGGARA BARAT': 'Nusa Tenggara Barat',
  'NUSA TENGGARA TIMUR': 'Nusa Tenggara Timur',
  'PAPUA BARAT DAYA': 'Papua Barat Daya',
  'PAPUA BARAT': 'Papua Barat',
  'PAPUA PEGUNUNGAN': 'Papua Pegunungan',
  'PAPUA SELATAN': 'Papua Selatan',
  'PAPUA TENGAH': 'Papua Tengah',
  PAPUA: 'Papua',
  'IRIAN JAYA': 'Papua',
  'IRIAN JAYA BARAT': 'Papua Barat',
  RIAU: 'Riau',
  'SULAWESI BARAT': 'Sulawesi Barat',
  'SULAWESI SELATAN': 'Sulawesi Selatan',
  'SULAWESI TENGAH': 'Sulawesi Tengah',
  'SULAWESI TENGGARA': 'Sulawesi Tenggara',
  'SULAWESI UTARA': 'Sulawesi Utara',
  'SUMATERA BARAT': 'Sumatera Barat',
  'SUMATERA SELATAN': 'Sumatera Selatan',
  'SUMATERA UTARA': 'Sumatera Utara',
  'SUMATRA BARAT': 'Sumatera Barat',
  'SUMATRA SELATAN': 'Sumatera Selatan',
  'SUMATRA UTARA': 'Sumatera Utara',
};

/**
 * Normalize a province name from the API to the canonical SVG province name.
 * Handles case inconsistencies: "dki jakarta", "DKI JAKARTA" → "DKI Jakarta".
 * Returns the original string if no mapping is found.
 */
export function normalizeProvinceName(province: string): string {
  if (!province) return '';
  const key = normalize(province);
  return PROVINCE_NAME_MAP[key] ?? province;
}