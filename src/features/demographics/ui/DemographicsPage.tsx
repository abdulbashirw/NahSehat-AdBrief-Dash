/**
 * Indemnity — Demographics (Member & Claimants Demographics)
 *
 * Age and gender composition of active members versus claimants within
 * the currently selected period (W1–W4 / Month / Custom, max 31 days).
 *
 * %Growth is computed as first-half → second-half of the selected period
 * (same midpoint-split approach as the KPI delta cards).
 *
 * Data comes from the AdmDailyClaim API response — no year-based splitting.
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
import KpiCard from "@/shared/components/common/KpiCard";
import SectionCard from "@/shared/components/common/SectionCard";
import ExportButton from "@/shared/components/common/ExportButton";
import { useExportEnabled } from "@/entities/settings/model/useSettings";
import EmptyState from "@/shared/components/common/EmptyState";
import ApiError from "@/shared/components/error/ApiError";
import { Skeleton } from "@/shared/ui/skeleton";
import { useIndemnityData } from "@/features/indemnity-overview/hooks/useIndemnityData";
import PeriodFilter from "@/features/indemnity-overview/components/PeriodFilter";
import { AGE_BUCKETS, byMonth, kpiDeltas, kpiSummary } from "@/entities/claim/lib/aggregate";
import type { MonthRow } from "@/entities/claim/lib/aggregate";
import {
  claimantAgeGenderGrowth,
  memberAgeGenderGrowth,
} from "@/features/indemnity-overview/utils/demoAgg";
import type { AgeGenderGrowthCell } from "@/features/indemnity-overview/utils/demoAgg";
import { cn } from "@/shared/lib/utils";
import { formatCompactIDR, formatDecimal, formatIDR, formatMonthShort, formatNumber, formatRatioPct } from "@/shared/lib/format";
import { useTranslation } from "react-i18next";

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

function growthBadge(growth: number | null): ReactElement {
  if (growth === null) return <span className="text-[#9CA3AF]">—</span>;
  const pct = Math.abs(growth * 100);
  const up = growth >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-bold tabular-nums", up ? "text-[#16A34A]" : "text-[#DC2626]")}>
      {up ? "▲" : "▼"} {pct.toFixed(1)}%
    </span>
  );
}

export default function Demographics() {
  const { t } = useTranslation();
  const { data, isLoading, isFetching, lastUpdated, isError, refetch } = useIndemnityData();
  const exportEnabled = useExportEnabled();

  const filteredClaims = data?.claims ?? [];
  const members = data?.members ?? [];

  const kpis = useMemo(() => kpiSummary(filteredClaims, members), [filteredClaims, members]);
  const deltas = useMemo(() => kpiDeltas(filteredClaims, members), [filteredClaims, members]);
  const monthly = useMemo(() => byMonth(filteredClaims), [filteredClaims]);

  // Age × gender matrices with first-half → second-half growth
  const memberMatrix = useMemo(
    () => memberAgeGenderGrowth(members, filteredClaims),
    [members, filteredClaims],
  );
  const claimantMatrix = useMemo(
    () => claimantAgeGenderGrowth(members, filteredClaims),
    [members, filteredClaims],
  );

  const [showBilling, setShowBilling] = useState(true);
  // Butterfly view: "current" (full period) | "split" (1st-half ghost + 2nd-half solid)
  const [view, setView] = useState<"current" | "split">("current");

  const memberMax = useMemo(
    () => Math.max(1, ...memberMatrix.flatMap((r) => [r.female, r.male])),
    [memberMatrix],
  );
  const claimantMax = useMemo(
    () => Math.max(1, ...claimantMatrix.flatMap((r) => [r.female, r.male])),
    [claimantMatrix],
  );

  const periode = "demographics";

  if (isError) return <ApiError onRetry={refetch} />;

  if (!isLoading && filteredClaims.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <PageTitle />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <PeriodFilter isFetching={isFetching} lastUpdated={lastUpdated} />
            {exportEnabled && (
              <div className="flex items-center gap-3">
                <div className="w-px self-stretch bg-[#E5E8EC]" />
                <ExportButton
                  filename={`adbrief-demographics-${periode}.csv`}
                  getPayload={() => ({
                    headers: [
                      t("demographics.ageGroup"),
                      t("demographics.memberFemale"), t("demographics.memberMale"), t("demographics.memberTotal"),
                      t("demographics.member1stHalf"), t("demographics.member2ndHalf"), t("demographics.memberGrowth"),
                      t("demographics.claimantsFemale"), t("demographics.claimantsMale"), t("demographics.claimantsTotal"),
                      t("demographics.claimants1stHalf"), t("demographics.claimants2ndHalf"), t("demographics.claimantsGrowth"),
                    ],
                    rows: AGE_BUCKETS.map((b, i) => {
                      const m = memberMatrix[i];
                      const c = claimantMatrix[i];
                      const fmtGrowth = (g: number | null) => (g === null ? "—" : `${(g * 100).toFixed(1)}%`);
                      return [
                        b,
                        m.female, m.male, m.total,
                        m.firstHalf, m.secondHalf, fmtGrowth(m.growth),
                        c.female, c.male, c.total,
                        c.firstHalf, c.secondHalf, fmtGrowth(c.growth),
                      ] as (string | number)[];
                    }),
                  })}
                />
              </div>
            )}
          </div>
        </div>
        <SectionCard title={t("demographics.title")}>
          <EmptyState />
        </SectionCard>
      </div>
    );
  }
  const sumOf = (rows: AgeGenderGrowthCell[], key: "female" | "male") => rows.reduce((s, r) => s + r[key], 0);
  const sumTotal = (rows: AgeGenderGrowthCell[]) => rows.reduce((s, r) => s + r.total, 0);
  const sumFirst = (rows: AgeGenderGrowthCell[]) => rows.reduce((s, r) => s + r.firstHalf, 0);
  const sumSecond = (rows: AgeGenderGrowthCell[]) => rows.reduce((s, r) => s + r.secondHalf, 0);
  const totalGrowth = (rows: AgeGenderGrowthCell[]): number | null => {
    const f = sumFirst(rows);
    const s = sumSecond(rows);
    if (f === 0) return s > 0 ? 1 : null;
    return (s - f) / f;
  };

  const chartData = monthly.map((m: MonthRow) => ({
    ...m,
    label: formatMonthShort(m.month).replace(" ", " '").slice(0, 7),
    rate: m.billing ? m.approved / m.billing : 0,
  }));

  return (
    <motion.div className="space-y-6" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageTitle />
        <div className="flex items-center justify-end gap-2">
          <PeriodFilter isFetching={isFetching} lastUpdated={lastUpdated} />
          {exportEnabled && (
            <>
              <div className="w-px self-stretch bg-[#E5E8EC]" />
              <ExportButton
                filename={`adbrief-demographics-${periode}.csv`}
                getPayload={() => ({
                  headers: [
                    t("demographics.ageGroup"),
                    t("demographics.memberFemale"), t("demographics.memberMale"), t("demographics.memberTotal"),
                    t("demographics.member1stHalf"), t("demographics.member2ndHalf"), t("demographics.memberGrowth"),
                    t("demographics.claimantsFemale"), t("demographics.claimantsMale"), t("demographics.claimantsTotal"),
                    t("demographics.claimants1stHalf"), t("demographics.claimants2ndHalf"), t("demographics.claimantsGrowth"),
                  ],
                  rows: AGE_BUCKETS.map((b, i) => {
                    const m = memberMatrix[i];
                    const c = claimantMatrix[i];
                    const fmtGrowth = (g: number | null) => (g === null ? "—" : `${(g * 100).toFixed(1)}%`);
                    return [
                      b,
                      m.female, m.male, m.total,
                      m.firstHalf, m.secondHalf, fmtGrowth(m.growth),
                      c.female, c.male, c.total,
                      c.firstHalf, c.secondHalf, fmtGrowth(c.growth),
                    ] as (string | number)[];
                  }),
                })}
              />
            </>
          )}
        </div>
      </div>

      {/* Content area — subtle dim during background refetch (not initial load) */}
      <div className="space-y-6 transition-opacity duration-300" style={{ opacity: isFetching && !isLoading ? 0.55 : 1 }}>
      {/* Section 1 — KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard index={0} loading={isLoading} label={t("demographics.claimants")} accent="#EA8C1F" value={kpis.claimants} format={formatNumber} delta={deltas.claimants} />
        <KpiCard index={1} loading={isLoading} label={t("demographics.transactions")} accent="#D9A400" value={kpis.transactions} format={formatNumber} delta={deltas.transactions} />
        <KpiCard index={2} loading={isLoading} label={t("demographics.avgTxnPerClaimant")} accent="#2563EB" value={kpis.avgTxnPerClaimant} format={formatDecimal} />
        <KpiCard index={3} loading={isLoading} label={t("demographics.avgApprovedPerClaimant")} accent="#7C3AED" value={kpis.avgApprovedPerClaimant} format={formatIDR} />
        <KpiCard index={4} loading={isLoading} label={t("demographics.billing")} accent="#9B2226" value={kpis.billing} format={formatIDR} delta={deltas.billing} spark={monthly.map((m) => m.billing)} />
        <KpiCard index={5} loading={isLoading} label={t("demographics.approved")} accent="#0F9488" value={kpis.approved} format={formatIDR} delta={deltas.approved} subline={`${formatRatioPct(kpis.approvedPct)} ${t("demographics.ofBilling")}`} spark={monthly.map((m) => m.approved)} />
      </div>

      {/* Section 2 — Member heatmap table with %Growth */}
      <motion.div variants={sectionVariants}>
        <SectionCard
          title={t("demographics.memberByAgeGender")}
          subtitle={t("demographics.memberByAgeGenderSubtitle")}
        >
          {isLoading ? (
            <Skeleton className="h-[360px] w-full" />
          ) : (
            <div className="overflow-auto rounded-lg border border-[#E5E8EC]">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#F1F3F5] text-[11.5px] font-bold uppercase tracking-wide text-[#4B5563]">
                    <th className="px-4 py-2 text-left">{t("demographics.ageGroup")}</th>
                    <th className="border-l border-[#E5E8EC] px-4 py-2 text-center" style={{ color: F_PINK }}>{t("demographics.female")}</th>
                    <th className="border-l border-[#E5E8EC] px-4 py-2 text-center" style={{ color: M_BLUE }}>{t("demographics.male")}</th>
                    <th className="border-l border-[#E5E8EC] px-4 py-2 text-center">{t("demographics.total")}</th>
                    <th className="border-l border-[#E5E8EC] px-4 py-2 text-center">{t("demographics.firstHalf")}</th>
                    <th className="border-l border-[#E5E8EC] px-4 py-2 text-center">{t("demographics.secondHalf")}</th>
                    <th className="border-l border-[#E5E8EC] px-4 py-2 text-center">{t("demographics.growth")}</th>
                  </tr>
                </thead>
                <tbody>
                  {AGE_BUCKETS.map((b, i) => {
                    const row = memberMatrix[i];
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
                        <td className="border-l border-[#E5E8EC] px-2 py-1.5">{cell(row.female)}</td>
                        <td className="border-l border-[#E5E8EC] px-2 py-1.5">{cell(row.male)}</td>
                        <td className="border-l border-[#E5E8EC] px-4 py-2 text-right font-bold tabular-nums text-[#1F2A37]">{formatNumber(row.total)}</td>
                        <td className="border-l border-[#E5E8EC] px-4 py-2 text-right tabular-nums text-[#6B7280]">{formatNumber(row.firstHalf)}</td>
                        <td className="border-l border-[#E5E8EC] px-4 py-2 text-right tabular-nums text-[#6B7280]">{formatNumber(row.secondHalf)}</td>
                        <td className="border-l border-[#E5E8EC] px-4 py-2 text-center text-[12px]">{growthBadge(row.growth)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#E5E8EC] font-bold text-[#1F2A37]">
                    <td className="px-4 py-2.5">{t("demographics.total")}</td>
                    <td className="border-l border-[#E5E8EC] px-4 py-2.5 text-right tabular-nums">{formatNumber(sumOf(memberMatrix, "female"))}</td>
                    <td className="border-l border-[#E5E8EC] px-4 py-2.5 text-right tabular-nums">{formatNumber(sumOf(memberMatrix, "male"))}</td>
                    <td className="border-l border-[#E5E8EC] px-4 py-2.5 text-right tabular-nums">{formatNumber(sumTotal(memberMatrix))}</td>
                    <td className="border-l border-[#E5E8EC] px-4 py-2.5 text-right tabular-nums text-[#6B7280]">{formatNumber(sumFirst(memberMatrix))}</td>
                    <td className="border-l border-[#E5E8EC] px-4 py-2.5 text-right tabular-nums text-[#6B7280]">{formatNumber(sumSecond(memberMatrix))}</td>
                    <td className="border-l border-[#E5E8EC] px-4 py-2.5 text-center text-[12px]">{growthBadge(totalGrowth(memberMatrix))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* Section 3 — Butterfly chart with split view */}
      <motion.div variants={sectionVariants}>
        <SectionCard
          title={t("demographics.claimantsByAgeGender")}
          subtitle={t("demographics.claimantsByAgeGenderSubtitle")}
          right={
            <div className="inline-flex rounded-[8px] bg-white/15 p-[3px]">
              {(["current", "split"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition-all",
                    view === v ? "bg-white text-[#1F2A37] shadow-sm" : "text-white/70 hover:text-white",
                  )}
                >
                  {v === "current" ? t("demographics.fullPeriod") : t("demographics.firstVsSecondHalf")}
                </button>
              ))}
            </div>
          }
        >
          {isLoading ? (
            <Skeleton className="h-[340px] w-full" />
          ) : (
            <div className="space-y-1.5">
              <div className="mb-3 flex items-center justify-center gap-6 text-[11.5px] font-semibold text-[#4B5563]">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: F_PINK }} /> {t("demographics.female")}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: M_BLUE }} /> {t("demographics.male")}</span>
                {view === "split" && (
                  <>
                    <span className="mx-2 text-[#9CA3AF]">|</span>
                    <span className="flex items-center gap-1.5 text-[#9CA3AF]"><span className="h-2.5 w-2.5 rounded-sm border border-[#9CA3AF] bg-[#E5E7EB]" /> {t("demographics.firstHalfGhost")}</span>
                    <span className="flex items-center gap-1.5 text-[#9CA3AF]"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#C4B5FD" }} /> {t("demographics.secondHalfSolid")}</span>
                  </>
                )}
              </div>
              {AGE_BUCKETS.map((b, i) => {
                const row = claimantMatrix[i];
                // In "split" mode, use secondHalf as the solid bar and firstHalf as ghost
                const fVal = view === "split" ? row.secondHalf : row.female;
                const mVal = view === "split" ? row.secondHalf : row.male;
                const fGhost = view === "split" ? row.firstHalf : 0;
                const mGhost = view === "split" ? row.firstHalf : 0;
                const fColor = view === "split" ? "#C4B5FD" : F_PINK;
                const mColor = view === "split" ? "#93C5FD" : M_BLUE;
                const splitMax = view === "split"
                  ? Math.max(1, ...claimantMatrix.flatMap((r) => [r.firstHalf, r.secondHalf]))
                  : claimantMax;
                const bar = (v: number, ghost: number, color: string, side: "l" | "r") => (
                  <div className={cn("relative flex h-7 flex-1 items-center", side === "l" ? "justify-end" : "justify-start")}>
                    {ghost > 0 && (
                      <span
                        className={cn("absolute h-7 rounded-md border border-[#9CA3AF]/40 bg-[#E5E7EB]", side === "l" ? "origin-right rounded-r-none" : "origin-left rounded-l-none")}
                        style={{ width: `${Math.max(1, (ghost / splitMax) * 100)}%` }}
                      />
                    )}
                    <motion.span
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.1 + Math.abs(3 - i) * 0.06, duration: 0.5, ease: "easeOut" }}
                      className={cn("relative h-7 rounded-md", side === "l" ? "origin-right rounded-r-none" : "origin-left rounded-l-none")}
                      style={{ width: `${Math.max(1, (v / splitMax) * 100)}%`, backgroundColor: color }}
                    />
                    <span className={cn("absolute text-[11.5px] font-bold tabular-nums text-[#1F2A37]", side === "l" ? "-left-0.5 -translate-x-full pr-1" : "-right-0.5 translate-x-full pl-1")}>
                      {formatNumber(v)}
                    </span>
                  </div>
                );
                return (
                  <div key={b} className="group grid grid-cols-[1fr_64px_1fr] items-center gap-1 rounded-md px-1 py-0.5 hover:bg-[#F8FAFB]">
                    {bar(fVal, fGhost, fColor, "l")}
                    <div className="flex flex-col items-center">
                      <span className="text-[12px] font-bold text-[#4B5563]">{b}</span>
                      {view === "split" && row.growth !== null && (
                        <span className={cn("text-[9.5px] font-bold", row.growth >= 0 ? "text-[#16A34A]" : "text-[#DC2626]")}>
                          {row.growth >= 0 ? "▲" : "▼"} {Math.abs(row.growth * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {bar(mVal, mGhost, mColor, "r")}
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
          title={t("demographics.trendMonthlyApproved")}
          right={
            <button
              onClick={() => setShowBilling((s) => !s)}
              className={cn("rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors", showBilling ? "bg-white text-[#2E7D5B]" : "bg-white/15 text-white/80 hover:text-white")}
            >
              {t("demographics.billingLine")} {showBilling ? t("demographics.billingLineOn") : t("demographics.billingLineOff")}
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
                        <div>{t("demographics.approvedTooltip")}: IDR {formatIDR(m.approved)}</div>
                        <div>{t("demographics.billingTooltip")}: IDR {formatIDR(m.billing)}</div>
                        <div>{t("demographics.rateTooltip")}: {formatRatioPct(m.rate)}</div>
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

      </div>
    </motion.div>
  );
}

function PageTitle() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="font-display text-[28px] font-extrabold text-[#1F2A37] md:text-[32px]">{t("demographics.title")}</h1>
      <p className="mt-1 text-sm italic text-[#9CA3AF]">
        {t("demographics.subtitle")}
      </p>
    </div>
  );
}