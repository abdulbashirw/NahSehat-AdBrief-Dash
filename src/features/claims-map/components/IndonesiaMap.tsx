/**
 * IndonesiaMap — Interactive SVG choropleth map.
 * Preserved from original AdBrief design.
 */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import mapRaw from '@/assets/indonesia-provinces.svg?raw';
import type { CityRow } from '@/entities/claim/lib/aggregate';
import type { ProviderLocation } from '@/entities/claim/lib/aggregate';
import { formatCompactIDR, formatIDR, formatNumber, formatRatioPct } from '@/shared/lib/format';

export type MapMetric = 'claimants' | 'transactions' | 'approved' | 'billing';

export const MAP_METRIC_KEYS: MapMetric[] = ['claimants', 'transactions', 'approved', 'billing'];

interface ProvincePath {
  name: string;
  d: string[];
}

/** Compute the bounding-box area of an SVG path's "d" attribute (rough, no DOM needed). */
function pathArea(d: string): number {
  // Extract all coordinate pairs from the path data
  const coords = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  if (coords.length < 4) return 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < coords.length; i += 2) {
    const x = coords[i], y = coords[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return (maxX - minX) * (maxY - minY);
}

/** Parse the simplified province SVG (paths tagged data-province) once.
 *  Sorted by area DESCENDING so small provinces (e.g. DKI Jakarta) render LAST
 *  (on top of larger neighbours) — standard cartographic z-order practice. */
function parseProvincePaths(): ProvincePath[] {
  const doc = new DOMParser().parseFromString(mapRaw, 'image/svg+xml');
  const out: ProvincePath[] = [];
  doc.querySelectorAll('path[data-province]').forEach((el) => {
    const name = el.getAttribute('data-province') ?? '';
    const d = el.getAttribute('d') ?? '';
    if (!name || !d) return;
    const existing = out.find((p) => p.name === name);
    if (existing) existing.d.push(d);
    else out.push({ name, d: [d] });
  });
  // Sort by total area of all sub-paths — largest first, smallest last (renders on top)
  out.sort((a, b) => {
    const areaA = a.d.reduce((sum, d) => sum + pathArea(d), 0);
    const areaB = b.d.reduce((sum, d) => sum + pathArea(d), 0);
    return areaB - areaA;
  });
  return out;
}

/** Blue sequential scale: lightest -> darkest (6 steps). Color DNA: Light Blue + Electric Blue + Cyan. */
const BLUE_SCALE = ['#EFF6FF', '#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#2563EB'];

function scaleColor(t: number): string {
  // t in 0..1 — use sqrt so mid-values stay distinguishable
  const x = Math.sqrt(Math.max(0, Math.min(1, t)));
  const idx = Math.min(BLUE_SCALE.length - 1, Math.floor(x * BLUE_SCALE.length));
  return BLUE_SCALE[idx];
}

interface Hover {
  name: string;
  row: CityRow | null;
  x: number;
  y: number;
}

export interface IndonesiaMapProps {
  data: Map<string, CityRow>;
  metric: MapMetric;
  pinned: string | null;
  onPin: (province: string | null) => void;
  locations?: ProviderLocation[];
  showLocations?: boolean;
}

/**
 * Project Indonesia lat/lng → SVG viewBox (1200×500) coordinates.
 * Linear projection calibrated against the simplified province SVG:
 *   lng 95°E → x≈40,  lng 141°E → x≈1130
 *   lat 6°N  → y≈55,  lat 11°S  → y≈430
 */
function projectLatLng(lat: number, lng: number): { x: number; y: number } {
  const x = (lng - 95) / 46 * 1090 + 40;
  const y = (6 - lat) / 17 * 375 + 55;
  return { x, y };
}

export default function IndonesiaMap({ data, metric, pinned, onPin, locations = [], showLocations = true }: IndonesiaMapProps) {
  const { t } = useTranslation();
  const paths = useMemo(parseProvincePaths, []);
  const [hover, setHover] = useState<Hover | null>(null);
  const [locHover, setLocHover] = useState<{ loc: ProviderLocation; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxVal = useMemo(() => {
    let m = 0;
    data.forEach((r) => {
      m = Math.max(m, r[metric]);
    });
    return m || 1;
  }, [data, metric]);

  /** Max value across provider locations for the current metric (marker sizing). */
  const maxLocVal = useMemo(() => {
    if (!showLocations || !locations.length) return 1;
    return Math.max(1, ...locations.map((l) => l[metric]));
  }, [locations, metric, showLocations]);

  const isIdr = metric === 'approved' || metric === 'billing';
  const fmtTick = (v: number) => (isIdr ? formatCompactIDR(v) : formatNumber(v));

  /** Marker radius: 3px (min) → 10px (max), scaled by metric value. */
  const markerRadius = (val: number) => 3 + Math.sqrt(val / maxLocVal) * 7;

  const handleMove = (e: React.MouseEvent, name: string) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({
      name,
      row: data.get(name) ?? null,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Legend */}
      <div className="mb-2 flex items-center justify-end gap-2 text-[11px] font-medium text-[#9CA3AF]">
        <span>{fmtTick(0)}</span>
        <div className="flex h-2.5 w-48 overflow-hidden rounded-full">
          {BLUE_SCALE.map((c) => (
            <span key={c} className="h-full flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span>{fmtTick(maxVal)}</span>
      </div>

      <svg viewBox="0 0 1200 500" className="h-auto w-full" role="img" aria-label="Choropleth map of Indonesia">
        <defs>
          <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#E5E8EC" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#D3D8DE" strokeWidth="1.5" opacity="0.6" />
          </pattern>
        </defs>
        {paths.map((p, i) => {
          const row = data.get(p.name);
          const val = row ? row[metric] : 0;
          const fill = !row || val === 0 ? 'url(#hatch)' : scaleColor(val / maxVal);
          const isPinned = pinned === p.name;
          return (
            <motion.g
              key={p.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.012, duration: 0.3 }}
            >
              {p.d.map((d, j) => (
                <path
                  key={j}
                  d={d}
                  fill={fill}
                  stroke={isPinned ? '#1F2A37' : '#FFFFFF'}
                  strokeWidth={isPinned ? 2.5 : 1.5}
                  strokeLinejoin="round"
                  className="cursor-pointer transition-[filter] duration-150 hover:brightness-110 hover:drop-shadow-[0_2px_3px_rgba(16,24,40,0.35)]"
                  onMouseMove={(e) => handleMove(e, p.name)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onPin(isPinned ? null : p.name)}
                />
              ))}
            </motion.g>
          );
        })}

        {/* Provider location markers (scatter overlay from COORDINATES) */}
        {showLocations && locations.map((loc) => {
          const { x, y } = projectLatLng(loc.lat, loc.lng);
          if (x < 0 || x > 1200 || y < 0 || y > 500) return null;
          const r = markerRadius(loc[metric]);
          return (
            <g key={loc.providerId}>
              <circle
                cx={x}
                cy={y}
                r={r}
                fill="#3FA37A"
                fillOpacity={0.55}
                stroke="#fff"
                strokeWidth={1.2}
                className="cursor-pointer transition-all duration-150 hover:fill-opacity-90"
                onMouseMove={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setLocHover({ loc, x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setLocHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-20 w-64 -translate-x-1/2 rounded-lg border border-[#E5E8EC] bg-white p-3 shadow-lg"
          style={{
            left: Math.min(Math.max(hover.x, 130), (containerRef.current?.clientWidth ?? 800) - 130),
            top: Math.max(hover.y - 12, 0),
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="text-[13px] font-bold text-[#1F2A37]">{hover.name}</div>
          {hover.row ? (
            <div className="mt-1.5 space-y-0.5 text-[12px] font-medium text-[#4B5563] tabular-nums">
              <div className="flex justify-between"><span>{t('claimsMap.tooltipClaimants')}</span><span className="font-semibold text-[#1F2A37]">{formatNumber(hover.row.claimants)}</span></div>
              <div className="flex justify-between"><span>{t('claimsMap.tooltipTransactionsLabel')}</span><span className="font-semibold text-[#1F2A37]">{formatNumber(hover.row.transactions)}</span></div>
              <div className="flex justify-between"><span>{t('claimsMap.tooltipBilling')}</span><span className="font-semibold text-[#1F2A37]">{t('claimsMap.tooltipIdr')} {formatIDR(hover.row.billing)}</span></div>
              <div className="flex justify-between"><span>{t('claimsMap.tooltipApproved')}</span><span className="font-semibold text-[#1F2A37]">{t('claimsMap.tooltipIdr')} {formatIDR(hover.row.approved)}</span></div>
              <div className="flex justify-between"><span>{t('claimsMap.pctApproved')}</span><span className="font-semibold text-[#2563EB]">{formatRatioPct(hover.row.billing ? hover.row.approved / hover.row.billing : 0)}</span></div>
            </div>
          ) : (
            <div className="mt-1 text-[12px] italic text-[#9CA3AF]">{t('claimsMap.noClaimsInPeriod')}</div>
          )}
          <div className="mt-1.5 text-[10.5px] font-medium uppercase tracking-wide text-[#9CA3AF]">{pinned === hover.name ? t('claimsMap.clickToUnpinProvince') : t('claimsMap.clickToPinProvince')}</div>
        </div>
      )}

      {/* Provider location tooltip */}
      {locHover && (
        <div
          className="pointer-events-none absolute z-30 w-64 -translate-x-1/2 rounded-lg border border-[#E5E8EC] bg-white p-3 shadow-lg"
          style={{
            left: Math.min(Math.max(locHover.x, 130), (containerRef.current?.clientWidth ?? 800) - 130),
            top: Math.max(locHover.y - 12, 0),
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="text-[13px] font-bold text-[#1F2A37]">{locHover.loc.providerName}</div>
          <div className="text-[11px] font-medium text-[#9CA3AF]">{locHover.loc.city}, {locHover.loc.province}</div>
          <div className="mt-1.5 space-y-0.5 text-[12px] font-medium text-[#4B5563] tabular-nums">
            <div className="flex justify-between"><span>{t('claimsMap.tooltipClaimants')}</span><span className="font-semibold text-[#1F2A37]">{formatNumber(locHover.loc.claimants)}</span></div>
            <div className="flex justify-between"><span>{t('claimsMap.tooltipTransactionsLabel')}</span><span className="font-semibold text-[#1F2A37]">{formatNumber(locHover.loc.transactions)}</span></div>
            <div className="flex justify-between"><span>{t('claimsMap.tooltipBilling')}</span><span className="font-semibold text-[#1F2A37]">{t('claimsMap.tooltipIdr')} {formatIDR(locHover.loc.billing)}</span></div>
            <div className="flex justify-between"><span>{t('claimsMap.tooltipApproved')}</span><span className="font-semibold text-[#1F2A37]">{t('claimsMap.tooltipIdr')} {formatIDR(locHover.loc.approved)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}