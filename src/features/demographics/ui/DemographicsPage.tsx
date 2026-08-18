/**
 * Indemnity — Demographics (Member & Claimants Demographics)
 *
 * Migrated from the original Demographics page to use RTK Query data.
 * All business logic (aggregation, KPIs, charts, tables) preserved.
 */
import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { motion } from "framer-motion";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import KpiCard from "@/shared/components/common/KpiCard";
import SectionCard from "@/shared/components/common/SectionCard";
import ExportButton from "@/shared/components/common/ExportButton";
import EmptyState from "@/shared/components/common/EmptyState";
import ApiError from "@/shared/components/error/ApiError";
import { Skeleton } from "@/shared/ui/skeleton";
import { useIndemnityData } from "@/features/indemnity-overview/hooks/useIndemnityData";
import PeriodFilter from "@/features/indemnity-overview/components/PeriodFilter";
import { AGE_BUCKETS, byMonth, kpiDeltas, kpiSummary } from "@/entities/claim/lib/aggregate";
import type { MonthRow } from "@/entities/claim/lib/aggregate";
import { claimantAgeGenderByYear, growth, memberAgeGenderByYear } from "@/features/indemnity-overview/utils/demoAgg";
import type { YearGenderCell } from "@/features/indemnity-overview/utils/demoAgg";
import { cn } from "@/shared/lib/utils";
import { formatCompactIDR, formatIDR, formatMonthShort, formatNumber, formatPct, formatRatioPct } from "@/shared/lib/format";

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

const F_PINK = "#EC6FA0";
const M_BLUE = "#3B82F6";
const HEAT_SCALE = ["#EFF6FF", "#DBEAFE", "#BFDBFE", "#93C5FD", "#60A5FA", "#3B82F6", "#1D4ED8"];

function heatColor(v: number, max: number): string {
  if (max <= 0 || v <= 0) return HEAT_SCALE[0];
  const t = Math.sqrt(v / max);
  return HEAT_SCALE[Math.min(HEAT_SCALE.length - 1, Math.floor(t * HEAT_SCALE.length))];
}

const formatDecimal = (n: number) =>
  n.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function GrowthCell({ g }: { g: number | null }) {
  if (g === null) return <span className="text-[#9CA3AF]">—</span>;
  const up = g >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", up ? "text-[#16A34A]" : "text-[#DC2626]")}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {formatPct(Math.abs(g) * 100)}
    </span>
  );
}

export default function Demographics() {
  const { data, isLoading, isError, refetch } = useIndemnityData();

  const filteredClaims = data?.claims ?? [];
  const members = data?.members ?? [];

  const kpis = useMemo(() => kpiSummary(filteredClaims, members), [filteredClaims, members]);
  const deltas = useMemo(() => kpiDeltas(filteredClaims, members), [filteredClaims, members]);
  const monthly = useMemo(() => byMonth(filteredClaims), [filteredClaims]);

  const member25 = useMemo(() => memberAgeGenderByYear(members, 2025), [members]);
  const member26 = useMemo(() => memberAgeGenderByYear(members, 2026), [members]);
  const claimant25 = useMemo(() => claimantAgeGenderByYear(members, filteredClaims, 2025), [members, filteredClaims]);
  const claimant26 = useMemo(() => claimantAgeGenderByYear(members, filteredClaims, 2026), [members, filteredClaims]);

  const [period, setPeriod] = useState<"2025" | "2026" | "both">("both");
  const [showBilling, setShowBilling] = useState(true);

  const memberMax = useMemo(
    () => Math.max(1, ...[...member25, ...member26].flatMap((r) => [r.female, r.male])),
    [member25, member26],
  );
  const claimantMax = useMemo(
    () => Math.max(1, ...[...claimant25, ...claimant26].flatMap((r) => [r.female, r.male])),
    [claimant25, claimant26],
  );

  const topMovers = useMemo(() => {
    const movers: { label: string; g: number }[] = [];
    AGE_BUCKETS.forEach((b, i) => {
      const gf = growth(claimant25[i].female, claimant26[i].female);
      const gm = growth(claimant25[i].male, claimant26[i].male);
      if (gf !== null && claimant26[i].female > 5) movers.push({ label: `${b} F`, g: gf });
      if (gm !== null && claimant26[i].male > 5) movers.push({ label: `${b} M`, g: gm });
    });
    return movers.sort((a, b) => b.g - a.g).slice(0, 3);
  }, [claimant25, claimant26]);

  if (isError) return <ApiError onRetry={refetch} />;

  if (!isLoading && filteredClaims.length === 0) {
    return (
      <div className="space-y-6">
        <PageTitle />
        <PeriodFilter />
        <SectionCard title="Member & Claimants Demographics">
          <EmptyState />
        </SectionCard>
      </div>
    );
  }

  const periode = "demographics";
  const sumOf = (rows: YearGenderCell[], key: "female" | "male") => rows.reduce((s, r) => s + r[key], 0);

  const chartData = monthly.map((m: MonthRow) => ({
    ...m,
    label: formatMonthShort(m.month).replace(" ", " '").slice(0, 7),
    rate: m.billing ? m.approved / m.billing : 0,
  }));

  const current = period === "2025" ? claimant25 : claimant26;
  const ghost = period === "both" ? claimant25 : null;
  const showGhost = period === "both";

  return (
    <motion.div className="space-y-6" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
      <PageTitle />
      <PeriodFilter />

      {/* Section 1 — KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard index={0} loading={isLoading} label="Claimants" accent="#EA8C1F" value={kpis.claimants} format={formatNumber} delta={deltas.claimants} />
        <KpiCard index={1} loading={isLoading} label="Transactions" accent="#D9A400" value={kpis.transactions} format={formatNumber} delta={deltas.transactions} />
        <KpiCard index={2} loading={isLoading} label="Avg. Transactions / Claimant" accent="#2563EB" value={kpis.avgTxnPerClaimant} format={formatDecimal} />
        <KpiCard index={3} loading={isLoading} label="Avg. Approved Bills / Claimant (IDR)" accent="#7C3AED" value={kpis.avgApprovedPerClaimant} format={formatIDR} />
        <KpiCard index={4} loading={isLoading} label="Billing (IDR)" accent="#9B2226" value={kpis.billing} format={formatIDR} delta={deltas.billing} spark={monthly.map((m) => m.billing)} />
        <KpiCard index={5} loading={isLoading} label="Approved (IDR)" accent="#0F9488" value={kpis.approved} format={formatIDR} delta={deltas.approved} subline={`${formatRatioPct(kpis.approvedPct)} of billing`} spark={monthly.map((m) => m.approved)} />
      </div>

      {/* Section 2 — Member heatmap table */}
      <motion.div variants={sectionVariants}>
        <SectionCard title="Member by Age Group by Gender">
          {isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : (
            <div className="overflow-auto rounded-lg border border-[#E5E8EC]">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F1F3F5] text-[11.5px] font-bold uppercase tracking-wide text-[#4B5563]">
                    <th rowSpan={2} className="px-4 py-2 text-left">Age Group</th>
                    <th colSpan={3} className="border-l border-[#E5E8EC] px-4 py-2 text-center" style={{ color: F_PINK }}>Female</th>
                    <th colSpan={3} className="border-l border-[#E5E8EC] px-4 py-2 text-center" style={{ color: M_BLUE }}>Male</th>
                  </tr>
                  <tr className="bg-[#F1F3F5] text-[11.5px] font-bold uppercase tracking-wide text-[#4B5563]">
                    {["2025", "2026", "%Growth", "2025", "2026", "%Growth"].map((h, i) => (
                      <th key={i} className={cn("px-4 py-2 text-right", (i === 0 || i === 3) && "border-l border-[#E5E8EC]")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {AGE_BUCKETS.map((b, i) => {
                    const f25 = member25[i].female, f26 = member26[i].female;
                    const m25 = member25[i].male, m26 = member26[i].male;
                    const cell = (v: number) => (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 + i * 0.05, duration: 0.4 }}
                        className="block rounded px-2 py-1 text-right font-semibold tabular-nums"
                        style={{ backgroundColor: heatColor(v, memberMax), color: v / memberMax > 0.45 ? "#fff" : "#1F2A37" }}
                      >
                        {formatNumber(v)}
                      </motion.span>
                    );
                    return (
                      <tr key={b} className="border-t border-[#E5E8EC] hover:bg-[#F8FAFB]">
                        <td className="px-4 py-2 font-semibold text-[#1F2A37]">{b}</td>
                        <td className="border-l border-[#E5E8EC] px-2 py-1.5">{cell(f25)}</td>
                        <td className="px-2 py-1.5">{cell(f26)}</td>
                        <td className="px-4 py-2 text-right"><GrowthCell g={growth(f25, f26)} /></td>
                        <td className="border-l border-[#E5E8EC] px-2 py-1.5">{cell(m25)}</td>
                        <td className="px-2 py-1.5">{cell(m26)}</td>
                        <td className="px-4 py-2 text-right"><GrowthCell g={growth(m25, m26)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#E5E8EC] font-bold text-[#1F2A37]">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="border-l border-[#E5E8EC] px-4 py-2.5 text-right tabular-nums">{formatNumber(sumOf(member25, "female"))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(sumOf(member26, "female"))}</td>
                    <td className="px-4 py-2.5 text-right"><GrowthCell g={growth(sumOf(member25, "female"), sumOf(member26, "female"))} /></td>
                    <td className="border-l border-[#E5E8EC] px-4 py-2.5 text-right tabular-nums">{formatNumber(sumOf(member25, "male"))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(sumOf(member26, "male"))}</td>
                    <td className="px-4 py-2.5 text-right"><GrowthCell g={growth(sumOf(member25, "male"), sumOf(member26, "male"))} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* Section 3 — Butterfly chart */}
      <motion.div variants={sectionVariants}>
        <SectionCard
          title="Claimants by Age Group by Gender"
          right={
            <span className="flex items-center gap-3">
              <span className="hidden items-center gap-2 lg:flex">
                {topMovers.map((t) => (
                  <span key={t.label} className="rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-semibold text-white tabular-nums">
                    {t.label} {t.g >= 0 ? "↑" : "↓"} {formatPct(Math.abs(t.g) * 100)}
                  </span>
                ))}
              </span>
              <span className="flex overflow-hidden rounded-md bg-white/15">
                {(["2025", "2026", "both"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-semibold capitalize text-white/80 transition-colors hover:text-white",
                      period === p && "bg-white text-[#2E7D5B] hover:text-[#2E7D5B]",
                    )}
                  >
                    {p === "both" ? "Both" : p}
                  </button>
                ))}
              </span>
            </span>
          }
        >
          {isLoading ? (
            <Skeleton className="h-[340px] w-full" />
          ) : (
            <div className="space-y-1.5">
              <div className="mb-3 flex items-center justify-center gap-6 text-[11.5px] font-semibold text-[#4B5563]">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: F_PINK }} /> Female</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: M_BLUE }} /> Male</span>
                {showGhost && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border-2 border-[#9CA3AF]" /> 2025 (ghost)</span>}
              </div>
              {AGE_BUCKETS.map((b, i) => {
                const f = current[i].female;
                const m = current[i].male;
                const gf = ghost ? ghost[i].female : 0;
                const gm = ghost ? ghost[i].male : 0;
                const bar = (v: number, color: string, ghostV: number, side: "l" | "r") => (
                  <div className={cn("relative flex h-7 flex-1 items-center", side === "l" ? "justify-end" : "justify-start")}>
                    {showGhost && ghostV > 0 && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 + i * 0.04, duration: 0.3 }}
                        className={cn("absolute h-7 rounded-md border-2", side === "l" ? "right-0 rounded-r-none" : "left-0 rounded-l-none")}
                        style={{ width: `${(ghostV / claimantMax) * 100}%`, borderColor: color, borderStyle: "dashed" }}
                      />
                    )}
                    <motion.span
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.1 + Math.abs(3 - i) * 0.06, duration: 0.5, ease: "easeOut" }}
                      className={cn("relative h-7 rounded-md", side === "l" ? "origin-right rounded-r-none" : "origin-left rounded-l-none")}
                      style={{ width: `${Math.max(1, (v / claimantMax) * 100)}%`, backgroundColor: color }}
                    />
                    <span className={cn("absolute text-[11.5px] font-bold tabular-nums text-[#1F2A37]", side === "l" ? "-left-0.5 -translate-x-full pr-1" : "-right-0.5 translate-x-full pl-1")}>
                      {formatNumber(v)}
                    </span>
                  </div>
                );
                return (
                  <div key={b} className="group grid grid-cols-[1fr_64px_1fr] items-center gap-1 rounded-md px-1 py-0.5 hover:bg-[#F8FAFB]">
                    {bar(f, F_PINK, gf, "l")}
                    <div className="text-center text-[12px] font-bold text-[#4B5563]">{b}</div>
                    {bar(m, M_BLUE, gm, "r")}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* Section 4 — Trend Monthly Total Approved */}
      <motion.div variants={sectionVariants}>
        <SectionCard
          title="Trend Monthly Total Approved"
          right={
            <button
              onClick={() => setShowBilling((s) => !s)}
              className={cn("rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors", showBilling ? "bg-white text-[#2E7D5B]" : "bg-white/15 text-white/80 hover:text-white")}
            >
              Billing line {showBilling ? "on" : "off"}
            </button>
          }
        >
          {isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={chartData} margin={{ top: 28, right: 16, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="approvedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EA8C1F" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#EA8C1F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F4" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={{ stroke: "#E5E8EC" }} />
                <YAxis tickFormatter={(v: number) => formatCompactIDR(v)} tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} width={60} />
                <Tooltip
                  cursor={{ stroke: "#E5E8EC" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const m = payload[0].payload as MonthRow & { rate: number };
                    return (
                      <div className="rounded-lg border border-[#E5E8EC] bg-white px-3 py-2 text-[12px] font-medium shadow-md tabular-nums">
                        <div className="mb-1 font-bold text-[#1F2A37]">{formatMonthShort(m.month)}</div>
                        <div>Approved: IDR {formatIDR(m.approved)}</div>
                        <div>Billing: IDR {formatIDR(m.billing)}</div>
                        <div>Rate: {formatRatioPct(m.rate)}</div>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="approved" stroke="none" fill="url(#approvedFill)" isAnimationActive animationDuration={900} />
                {showBilling && (
                  <Line type="monotone" dataKey="billing" stroke="#D64545" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive animationDuration={1000} />
                )}
                <Line
                  type="monotone"
                  dataKey="approved"
                  stroke="#EA8C1F"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#EA8C1F", stroke: "#fff", strokeWidth: 2 }}
                  isAnimationActive
                  animationDuration={1000}
                  label={((props: { x?: number | string; y?: number | string; index?: number }): ReactElement => {
                    const { x, y, index } = props;
                    if (x === undefined || y === undefined || index === undefined) return <g />;
                    const rate = chartData[index as number]?.rate ?? 0;
                    return (
                      <g transform={`translate(${Number(x)},${Number(y) - 14})`}>
                        <rect x={-24} y={-10} width={48} height={17} rx={8.5} fill="#fff" stroke="#EA8C1F" strokeWidth={1} opacity={0.95} />
                        <text textAnchor="middle" dy={2.5} fontSize={10} fontWeight={700} fill="#B96F0F">
                          {formatRatioPct(rate)}
                        </text>
                      </g>
                    );
                  }) as never}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </motion.div>

      {/* Section 5 — Export */}
      <motion.div variants={sectionVariants} className="flex items-center justify-end">
        <ExportButton
          filename={`adbrief-demographics-${periode}.csv`}
          getPayload={() => ({
            headers: ["Age Group", "F 2025", "F 2026", "F %Growth", "M 2025", "M 2026", "M %Growth", "Claimants F 2025", "Claimants F 2026", "Claimants M 2025", "Claimants M 2026"],
            rows: AGE_BUCKETS.map((b, i) => [
              b,
              member25[i].female, member26[i].female, growth(member25[i].female, member26[i].female) ?? "",
              member25[i].male, member26[i].male, growth(member25[i].male, member26[i].male) ?? "",
              claimant25[i].female, claimant26[i].female, claimant25[i].male, claimant26[i].male,
            ] as (string | number)[]),
          })}
        />
      </motion.div>
    </motion.div>
  );
}

function PageTitle() {
  return (
    <div>
      <h1 className="font-display text-[28px] font-extrabold text-[#1F2A37] md:text-[32px]">Member &amp; Claimants Demographics</h1>
      <p className="mt-1 text-sm italic text-[#9CA3AF]">
        Age and gender composition of active members versus claimants, with growth against the previous period
      </p>
    </div>
  );
}