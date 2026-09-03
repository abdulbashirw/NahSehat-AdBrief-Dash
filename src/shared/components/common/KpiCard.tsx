/**
 * KpiCard — animated KPI card with sparkline support.
 * Supports 'light' (default) and 'dark' variants for different backgrounds.
 * Preserved from original AdBrief design with tweening animation.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cn } from '@/shared/lib/utils';
import { formatPct } from '@/shared/lib/format';
import { Skeleton } from '@/shared/ui/skeleton';
import { useTranslation } from 'react-i18next';

/** Number that tweens old -> new over 800ms with easeOutCubic (jumps instantly
 *  when the user prefers reduced motion). */
function useTweenedNumber(value: number): number {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    if (reduceMotion || from === value) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduceMotion]);
  return display;
}

export interface KpiCardProps {
  label: string;
  accent: string;
  value: number;
  format: (n: number) => string;
  delta?: number;
  subline?: string;
  spark?: number[];
  loading?: boolean;
  index?: number;
  /** Visual variant: 'light' for white backgrounds, 'dark' for dark/navy backgrounds */
  variant?: 'light' | 'dark';
}

export default function KpiCard({
  label,
  accent,
  value,
  format,
  delta,
  subline,
  spark,
  loading,
  index = 0,
  variant = 'light',
}: KpiCardProps) {
  const { t } = useTranslation();
  const tweened = useTweenedNumber(loading ? 0 : value);
  const up = (delta ?? 0) >= 0;
  const isDark = variant === 'dark';

  if (loading) {
    return (
      <div className={cn(
        'rounded-xl p-3',
        isDark
          ? 'border border-white/[0.08] bg-white/[0.06]'
          : 'border border-[#E5E8EC] bg-white',
      )}>
        <Skeleton className={cn('h-2.5 w-16', isDark && 'bg-white/10')} />
        <Skeleton className={cn('mt-2 h-5 w-24', isDark && 'bg-white/10')} />
        <Skeleton className={cn('mt-2 h-3 w-20', isDark && 'bg-white/10')} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: index * 0.06 }}
      whileHover={{
        y: -2,
        boxShadow: isDark
          ? '0 4px 24px rgba(0,0,0,0.4)'
          : '0 4px 12px rgba(16,24,40,0.08)',
        transition: { duration: 0.15 },
      }}
      className={cn(
        'relative overflow-hidden rounded-xl p-3',
        isDark
          ? 'border border-white/[0.08] bg-white/[0.06] shadow-[0_2px_16px_rgba(0,0,0,0.25)] backdrop-blur-sm'
          : 'border border-[#E5E8EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{
            color: accent,
            backgroundColor: isDark ? `${accent}25` : `${accent}1F`,
          }}
        >
          {label}
        </span>
        {delta !== undefined &&
          (up ? (
            <TrendingUp className={cn('h-3.5 w-3.5 shrink-0', isDark ? 'text-[#34D399]' : 'text-[#16A34A]')} />
          ) : (
            <TrendingDown className={cn('h-3.5 w-3.5 shrink-0', isDark ? 'text-[#F87171]' : 'text-[#DC2626]')} />
          ))}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div
          className={cn(
            'text-[20px] font-extrabold leading-none tabular-nums xl:text-[22px]',
            isDark ? 'text-white' : 'text-[#1F2A37]',
          )}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {format(tweened)}
        </div>
        {spark && spark.length > 1 && (
          <div className="h-7 w-16 shrink-0 opacity-70">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={1.5} fill={accent} fillOpacity={isDark ? 0.2 : 0.15} isAnimationActive animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {subline && (
        <div className={cn(
          'mt-1.5 text-[10.5px] font-semibold tabular-nums',
          isDark ? 'text-[#94A3B8]' : 'text-[#4B5563]',
        )}>
          {subline}
        </div>
      )}
      {delta !== undefined && (
        <div className={cn(
          'mt-1 text-[10.5px] font-medium',
          up
            ? (isDark ? 'text-[#34D399]' : 'text-[#16A34A]')
            : (isDark ? 'text-[#F87171]' : 'text-[#DC2626]'),
        )}>
          {up ? `↑ ${t('common.up')}` : `↓ ${t('common.down')}`} {t('common.by')} {formatPct(Math.abs(delta) * 100)} {t('common.comparedToLastPeriod')}
        </div>
      )}
    </motion.div>
  );
}