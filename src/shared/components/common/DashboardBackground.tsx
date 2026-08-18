/**
 * DashboardBackground — Premium animated background for AdBrief × NahSehat.
 *
 * Renders the SVG data-flow background with layered CSS animations:
 *   - Slow background drift (data flowing)
 *   - Pulsing glow orbs (intelligence focal points)
 *   - Flowing data streams (data in motion)
 *   - Floating particles (individual data points)
 *   - Shimmer sparkles (insight moments)
 *
 * Visual concept: "Data in Motion. Intelligence in Focus."
 * Color DNA: Light Blue + Electric Blue + Cyan + Teal
 *
 * Uses CSS animations only (GPU-accelerated transforms & opacity).
 * Respects prefers-reduced-motion.
 */
import { useMemo } from 'react';
import { cn } from '@/shared/lib/utils';

interface DashboardBackgroundProps {
  /** 'dashboard' = within AppLayout content area; 'fullscreen' = full viewport (TabLayout) */
  variant?: 'dashboard' | 'fullscreen';
  className?: string;
}

/**
 * Deterministic pseudo-random number generator.
 * Seed ensures consistent particle positions across renders (no hydration mismatch).
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Pre-defined glow orbs — positioned to suggest intelligence focal areas */
const GLOW_ORBS = [
  { x: 12, y: 20, size: 200, color: '59, 130, 246', opacity: 0.07, duration: 8 },
  { x: 55, y: 10, size: 260, color: '6, 182, 212', opacity: 0.05, duration: 11 },
  { x: 82, y: 55, size: 180, color: '37, 99, 235', opacity: 0.06, duration: 9 },
  { x: 35, y: 65, size: 140, color: '20, 184, 166', opacity: 0.04, duration: 10 },
] as const;

/** Pre-defined data stream lines — flowing from left to right */
const DATA_STREAMS = [
  { y: 25, width: 45, duration: 28, delay: 0, opacity: 0.15 },
  { y: 42, width: 38, duration: 34, delay: 6, opacity: 0.10 },
  { y: 60, width: 50, duration: 24, delay: 10, opacity: 0.12 },
  { y: 78, width: 32, duration: 30, delay: 3, opacity: 0.08 },
  { y: 50, width: 28, duration: 26, delay: 14, opacity: 0.06 },
] as const;

/** Pre-defined shimmer sparkles — twinkling insight moments */
const SPARKLES = [
  { x: 22, y: 18, size: 7, duration: 4.5, delay: 0 },
  { x: 48, y: 32, size: 9, duration: 5.5, delay: 1.2 },
  { x: 73, y: 12, size: 6, duration: 3.8, delay: 0.6 },
  { x: 38, y: 52, size: 8, duration: 5, delay: 2.0 },
  { x: 88, y: 38, size: 7, duration: 4.2, delay: 1.5 },
  { x: 62, y: 68, size: 5, duration: 3.5, delay: 0.3 },
] as const;

export default function DashboardBackground({ variant = 'dashboard', className }: DashboardBackgroundProps) {
  /** Generate floating particles with deterministic positions */
  const particles = useMemo(() => {
    const rand = seededRandom(42);
    const colors = ['96, 165, 250', '147, 197, 253', '6, 182, 212', '59, 130, 246'];
    return Array.from({ length: 22 }, (_, i) => ({
      id: i,
      x: rand() * 100,
      y: rand() * 100,
      size: 1.5 + rand() * 2.5,
      opacity: 0.12 + rand() * 0.28,
      duration: 7 + rand() * 9,
      delay: rand() * 6,
      color: colors[Math.floor(rand() * colors.length)],
    }));
  }, []);

  const isDashboard = variant === 'dashboard';

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        isDashboard ? 'rounded-2xl' : '',
        className,
      )}
      aria-hidden="true"
    >
      {/* ── Layer 0: SVG Background with slow drift ── */}
      <div
        className="animate-bg-drift absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{ backgroundImage: "url('/bg-dashboard.svg')" }}
      />

      {/* ── Layer 1: Gradient overlay for readability ── */}
      <div
        className={cn(
          'absolute inset-0',
          isDashboard
            ? 'bg-gradient-to-b from-white/60 via-white/40 to-[#F4F6F8]/90'
            : 'bg-gradient-to-b from-white/50 via-white/35 to-white/60',
        )}
      />

      {/* ── Layer 2: Radial glow orbs (intelligence focal points) ── */}
      {GLOW_ORBS.map((orb) => (
        <div
          key={`orb-${orb.x}-${orb.y}`}
          className="animate-pulse-glow absolute rounded-full"
          style={{
            left: `${orb.x}%`,
            top: `${orb.y}%`,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, rgba(${orb.color}, ${orb.opacity}) 0%, transparent 70%)`,
            animationDuration: `${orb.duration}s`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}

      {/* ── Layer 3: Data flow streams (data in motion) ── */}
      {DATA_STREAMS.map((stream, i) => (
        <div
          key={`stream-${i}`}
          className="animate-data-stream absolute h-px"
          style={{
            top: `${stream.y}%`,
            left: '-20%',
            width: `${stream.width}%`,
            background: `linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, ${stream.opacity}) 25%, rgba(6, 182, 212, ${stream.opacity}) 75%, transparent 100%)`,
            animationDuration: `${stream.duration}s`,
            animationDelay: `${stream.delay}s`,
          }}
        />
      ))}

      {/* ── Layer 4: Floating particles (individual data points) ── */}
      {particles.map((p) => (
        <div
          key={`particle-${p.id}`}
          className="animate-float-particle absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: `rgba(${p.color}, ${p.opacity})`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* ── Layer 5: Shimmer sparkles (insight moments) ── */}
      {SPARKLES.map((s, i) => (
        <div
          key={`sparkle-${i}`}
          className="animate-shimmer absolute"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        >
          <div
            className="h-full w-full rotate-45"
            style={{
              background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.8) 0%, rgba(6, 182, 212, 0.8) 100%)',
              borderRadius: '2px',
            }}
          />
        </div>
      ))}

      {/* ── Layer 6: Bottom vignette (fade to page background) ── */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0',
          isDashboard
            ? 'h-28 bg-gradient-to-t from-[#F4F6F8] to-transparent'
            : 'h-36 bg-gradient-to-t from-white/70 to-transparent',
        )}
      />

      {/* ── Layer 7: Top subtle vignette for depth ── */}
      <div
        className={cn(
          'absolute inset-x-0 top-0',
          isDashboard
            ? 'h-16 bg-gradient-to-b from-white/30 to-transparent'
            : 'h-20 bg-gradient-to-b from-white/25 to-transparent',
        )}
      />
    </div>
  );
}