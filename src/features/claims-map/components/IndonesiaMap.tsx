/**
 * IndonesiaMap — Interactive SVG choropleth map.
 * Preserved from original AdBrief design.
 */
import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import mapRaw from '@/assets/indonesia-provinces.svg?raw';
import type { CityRow } from '@/entities/claim/lib/aggregate';
import { formatCompactIDR, formatIDR, formatNumber, formatRatioPct } from '@/shared/lib/format';

export type MapMetric = 'claimants' | 'transactions' | 'approved' | 'billing';

export const MAP_METRIC_OPTIONS: { key: MapMetric; label: string }[] = [
  { key: 'claimants', label: 'Total Claimant' },
  { key: 'transactions', label: 'Total Transaction' },
  { key: 'approved', label: 'Total Approved' },
  { key: 'billing', label: 'Billing' },
];

interface ProvincePath {
  name: string;
  d: string[];
}

/** Parse the simplified province SVG (paths tagged data-province) once. */
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
}

export default function IndonesiaMap({ data, metric, pinned, onPin }: IndonesiaMapProps) {
  const paths = useMemo(parseProvincePaths, []);
  const [hover, setHover] = useState<Hover | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxVal = useMemo(() => {
    let m = 0;
    data.forEach((r) => {
      m = Math.max(m, r[metric]);
    });
    return m || 1;
  }, [data, metric]);

  const isIdr = metric === 'approved' || metric === 'billing';
  const fmtTick = (v: number) => (isIdr ? formatCompactIDR(v) : formatNumber(v));

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
              <div className="flex justify-between"><span>Claimants</span><span className="font-semibold text-[#1F2A37]">{formatNumber(hover.row.claimants)}</span></div>
              <div className="flex justify-between"><span>Transactions</span><span className="font-semibold text-[#1F2A37]">{formatNumber(hover.row.transactions)}</span></div>
              <div className="flex justify-between"><span>Billing</span><span className="font-semibold text-[#1F2A37]">IDR {formatIDR(hover.row.billing)}</span></div>
              <div className="flex justify-between"><span>Approved</span><span className="font-semibold text-[#1F2A37]">IDR {formatIDR(hover.row.approved)}</span></div>
              <div className="flex justify-between"><span>%Approved</span><span className="font-semibold text-[#2563EB]">{formatRatioPct(hover.row.billing ? hover.row.approved / hover.row.billing : 0)}</span></div>
            </div>
          ) : (
            <div className="mt-1 text-[12px] italic text-[#9CA3AF]">No claims in this period</div>
          )}
          <div className="mt-1.5 text-[10.5px] font-medium uppercase tracking-wide text-[#9CA3AF]">Click to {pinned === hover.name ? 'unpin' : 'pin'} province</div>
        </div>
      )}
    </div>
  );
}