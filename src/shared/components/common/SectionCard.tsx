/**
 * SectionCard — Card with a signature section bar on top.
 * Supports 'light' (default, blue gradient bar) and 'dark' (blue gradient bar on glass) variants.
 * Color DNA: Light Blue + Electric Blue + Cyan + Teal
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
      <div className="flex h-9 shrink-0 items-center justify-between gap-4 px-4 bg-gradient-to-r from-[#1E3A6E] via-[#2563EB] to-[#06B6D4]">
        <div className="flex flex-col justify-center">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.04em] text-white">{title}</h2>
          {subtitle && <p className="text-[10px] font-medium text-white/70">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className={cn(
        'flex min-h-0 flex-1 flex-col p-4',
        isDark ? 'bg-transparent' : 'bg-white',
        bodyClassName,
      )}>{children}</div>
    </section>
  );
}