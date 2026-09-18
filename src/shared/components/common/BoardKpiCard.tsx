import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/shared/lib/utils";
import { formatPct } from "@/shared/lib/format";
import RollingCounter from "@/shared/components/common/RollingCounter";

export interface BoardKpiCardProps {
  index?: number;
  label: string;
  value: string | number;
  icon: LucideIcon;
  sublabel: string;
  iconBg: string;
  iconColor: string;
  dotColor: string;
  topBorder: string;
  accent: string;
  delta?: number;
  spark?: number[];
}

export default function BoardKpiCard({
  index = 0,
  label,
  value,
  icon: IconComp,
  sublabel,
  iconBg,
  iconColor,
  dotColor,
  topBorder,
  accent,
  delta,
  spark,
}: BoardKpiCardProps) {
  const reduceMotion = useReducedMotion();
  const up = (delta ?? 0) >= 0;

  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#E5E8EC] bg-white p-3.5 shadow-xs transition-all duration-200 hover:shadow-md",
        "border-t-[3px]",
        topBorder,
      )}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-3 -top-2 h-[92px] w-[92px] overflow-hidden"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 5, 0, -3, 0], y: [0, -4, 1, 3, 0], rotate: [0, 2.5, 0, -2, 0] }
        }
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: index * 0.55 }}
      >
        <IconComp
          strokeWidth={1.15}
          className="absolute left-1.5 top-1.5 h-full w-full"
          style={{ color: accent, opacity: 0.05 }}
        />
        <IconComp
          strokeWidth={1.15}
          className="relative h-full w-full"
          style={{ color: accent, opacity: 0.11 }}
        />
        {!reduceMotion && (
          <motion.span
            className="absolute inset-y-0 w-10 -skew-x-12 bg-gradient-to-r from-transparent via-white to-transparent"
            style={{ mixBlendMode: "soft-light", opacity: 0.55 }}
            animate={{ x: [-40, 110] }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              repeatDelay: 7,
              ease: [0.4, 0, 0.2, 1],
              delay: index * 0.7 + 1.2,
            }}
          />
        )}
      </motion.div>

      <div className="relative z-10 flex items-center gap-2">
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", iconBg)}>
          <IconComp className={cn("h-3.5 w-3.5", iconColor)} strokeWidth={2.2} />
        </div>
        <span className="truncate text-[13px] font-extrabold uppercase tracking-wide text-[#1F2A37]">
          {label}
        </span>
      </div>

      <div className="relative z-10 mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0 font-display text-[18px] font-extrabold tabular-nums tracking-tight text-[#1F2A37] xl:text-[22px]">
          <RollingCounter value={value} />
        </div>
        {spark && spark.length > 1 && (
          <div className="h-7 w-16 shrink-0 opacity-70">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={1.5} fill={accent} fillOpacity={0.15} isAnimationActive animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="relative z-10 mt-1 flex items-center justify-between gap-1.5 text-[11px] font-medium text-[#9CA3AF]">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor)} />
          <span className="truncate">{sublabel}</span>
        </span>
        {delta !== undefined && (
          <span className={cn("shrink-0 tabular-nums", up ? "text-[#16A34A]" : "text-[#DC2626]")}>
            {up ? "↑" : "↓"} {formatPct(Math.abs(delta) * 100)}
          </span>
        )}
      </div>
    </motion.div>
  );
}
