/**
 * SectionCard — Card with a signature section bar on top.
 * Supports 'light' (default, navy gradient bar) and 'dark' (navy gradient bar on glass) variants.
 * Color DNA: Deep Navy + Professional Blue (international-standard, minimalist, high-contrast
 * for white text, white-opacity controls, and colored legend swatches in the right slot).
 */
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export interface SectionCardProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Visual variant: 'light' for white backgrounds, 'dark' for dark/navy backgrounds */
  variant?: 'light' | 'dark';
}

export default function SectionCard({
  title,
  subtitle,
  right,
  children,
  className,
  bodyClassName,
  variant = 'light',
}: SectionCardProps) {
  const isDark = variant === 'dark';

  return (
    <section className={cn(
      'flex min-h-0 flex-col overflow-hidden rounded-xl',
      isDark
        ? 'border border-white/[0.08] bg-white/[0.06] shadow-[0_4px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl'
        : 'border border-[#E5E8EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]',
      className,
    )}>
      <div className="flex h-9 shrink-0 items-center justify-between gap-4 px-4 bg-gradient-to-r from-[#1E3A6E] to-[#2C5282] shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="flex min-w-0 flex-col justify-center">
          <h2 className="truncate text-[12px] font-bold uppercase tracking-[0.04em] text-white">{title}</h2>
          {subtitle && <p className="truncate text-[10px] font-medium text-white/70">{subtitle}</p>}
        </div>
        {right && <div className="flex shrink-0 items-center">{right}</div>}
      </div>
      <div className={cn(
        'flex min-h-0 flex-1 flex-col p-4',
        isDark ? 'bg-transparent' : 'bg-white',
        bodyClassName,
      )}>{children}</div>
    </section>
  );
}