/**
 * Indemnity — Utilization Overview
 *
 * TV / ops-board chrome (rolling KPI cards) with original Overview content,
 * chart language aligned with Daily Monitoring:
 *   - Coverage ranking lists (patient + billing)
 *   - Interactive payment donut
 *   - Channel table + benefit utilization table
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Activity,
  BadgeCheck,
  Building2,
  Receipt,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import SectionCard from "@/shared/components/common/SectionCard";
import DataTable from "@/shared/components/common/DataTable";
import type { DataColumn } from "@/shared/components/common/DataTable";
import ExportButton from "@/shared/components/common/ExportButton";
import { useExportEnabled } from "@/entities/settings/model/useSettings";
import EmptyState from "@/shared/components/common/EmptyState";
import ApiError from "@/shared/components/error/ApiError";
import { Skeleton } from "@/shared/ui/skeleton";
import { useIndemnityData } from "@/features/indemnity-overview/hooks/useIndemnityData";
import PeriodFilter from "@/features/indemnity-overview/components/PeriodFilter";
import {
  byCoverage,
  byMonth,
  kpiDeltas,
  kpiSummary,
  paymentSplit,
  providerSplit,
} from "@/entities/claim/lib/aggregate";
import type { CoverageRow } from "@/entities/claim/lib/aggregate";
import {
  formatCompactIDR,
  formatIDR,
  formatNumber,
  formatPct,
  formatRatioPct,
} from "@/shared/lib/format";

const SERVICES_RAMP = ["#1D4ED8", "#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"];
const BILLING_YELLOW = "#F2C230";
const APPROVED_RED = "#D64545";

const PAYMENT_THEME = {
  CASHLESS: {
    solid: "#2563EB",
    gradientFrom: "#60A5FA",
    gradientTo: "#2563EB",
    gradientId: "gradient-pay-cashless",
    bgLight: "bg-[#EFF6FF]",
    borderLight: "border-[#BFDBFE]",
    badgeBg: "bg-[#DBEAFE]",
    badgeText: "text-[#1D4ED8]",
  },
  REIMBURSEMENT: {
    solid: "#B45309",
    gradientFrom: "#FDE68A",
    gradientTo: "#F2C230",
    gradientId: "gradient-pay-reimburse",
    bgLight: "bg-[#FFFBEB]",
    borderLight: "border-[#FDE68A]",
    badgeBg: "bg-[#FEF3C7]",
    badgeText: "text-[#92400E]",
  },
} as const;

function RankBadge({ index }: { index: number }) {
  const rankBadge =
    index === 0
      ? "bg-amber-100 text-amber-800 border-amber-300 font-extrabold shadow-2xs"
      : index === 1
        ? "bg-slate-100 text-slate-700 border-slate-300 font-bold"
        : index === 2
          ? "bg-orange-100 text-orange-800 border-orange-300 font-bold"
          : "bg-[#F3F4F6] text-[#6B7280] border-[#E5E8EC] font-semibold";
  return (
    <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] tabular-nums", rankBadge)}>
      {index + 1}
    </span>
  );
}

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />;
}

function RollingDigit({ digit, delay }: { digit: string; delay: number }) {
  const [target, setTarget] = useState(0);

  useEffect(() => {
    const num = parseInt(digit, 10);
    if (!isNaN(num)) {
      const timer = setTimeout(() => setTarget(num), 50);
      return () => clearTimeout(timer);
    }
  }, [digit]);

  if (isNaN(parseInt(digit, 10))) {
    return <span className="inline-block">{digit}</span>;
  }

  return (
    <div className="relative inline-block h-[1em] overflow-hidden leading-none">
      <div
        className="flex flex-col transition-transform"
        style={{
          transform: `translateY(-${target * 10}%)`,
          transitionDuration: "2000ms",
          transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
          transitionDelay: `${delay}s`,
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <span key={num} className="flex h-[1em] items-center justify-center">
            {num}
          </span>
        ))}
      </div>
    </div>
  );
}

function RollingCounter({ value }: { value: string | number }) {
  const digits = value.toString().split("");
  return (
    <div className="inline-flex items-center">
      {digits.map((digit, index) => (
        <RollingDigit key={`${index}-${digit}`} digit={digit} delay={index * 0.08} />
      ))}
    </div>
  );
}

export default function Overview() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { data, isLoading, isFetching, isError, refetch } = useIndemnityData();
  const exportEnabled = useExportEnabled();

  const filteredClaims = data?.claims;
  const members = data?.members;
  const providers = data?.providers;

  const kpis = useMemo(() => kpiSummary(filteredClaims ?? [], members ?? []), [filteredClaims, members]);
  const deltas = useMemo(() => kpiDeltas(filteredClaims ?? [], members ?? []), [filteredClaims, members]);
  const coverageRows = useMemo(() => byCoverage(filteredClaims ?? []), [filteredClaims]);
  const monthly = useMemo(() => byMonth(filteredClaims ?? []), [filteredClaims]);
  const channels = useMemo(() => providerSplit(filteredClaims ?? [], providers ?? []), [filteredClaims, providers]);
  const payments = useMemo(() => paymentSplit(filteredClaims ?? []), [filteredClaims]);

  const totalCoverageClaimants = kpis.claimants || 1;
  const maxCoverageClaimants = useMemo(
    () => (coverageRows.length > 0 ? Math.max(...coverageRows.map((r) => r.claimants)) : 1),
    [coverageRows],
  );
  const maxCoverageBilling = useMemo(
    () => (coverageRows.length > 0 ? Math.max(...coverageRows.map((r) => r.billing)) : 1),
    [coverageRows],
  );
  const totalCoverageBilling = useMemo(
    () => coverageRows.reduce((sum, row) => sum + row.billing, 0) || 1,
    [coverageRows],
  );

  const [activeSlice, setActiveSlice] = useState<number | null>(null);
  const [liveClock, setLiveClock] = useState("");
  const [isTrendPaused, setIsTrendPaused] = useState(false);
  const [isBillingPaused, setIsBillingPaused] = useState(false);
  const trendScrollRef = useRef<HTMLDivElement | null>(null);
  const billingScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setLiveClock(`${hh}:${min}:${ss}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isTrendPaused) return;
      const el = trendScrollRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollTop + clientHeight >= scrollHeight - 1) {
        el.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ top: 50, behavior: "smooth" });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isTrendPaused]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isBillingPaused) return;
      const el = billingScrollRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollTop + clientHeight >= scrollHeight - 1) {
        el.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ top: 50, behavior: "smooth" });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isBillingPaused]);

  const cards = useMemo(
    () => [
      {
        id: "memberActive",
        label: t("overview.memberActive"),
        value: formatNumber(kpis.memberActive),
        icon: Users,
        sublabel: t("overview.memberActiveSub"),
        iconBg: "bg-[#EFF6FF]",
        iconColor: "text-[#2563EB]",
        dotColor: "bg-[#2563EB]",
        topBorder: "border-t-[#2563EB]",
        accent: "#2563EB",
        delta: deltas.memberActive,
      },
      {
        id: "claimants",
        label: t("overview.claimants"),
        value: formatNumber(kpis.claimants),
        icon: UserCheck,
        sublabel: t("overview.claimantsSub"),
        iconBg: "bg-[#FFF7ED]",
        iconColor: "text-[#EA8C1F]",
        dotColor: "bg-[#EA8C1F]",
        topBorder: "border-t-[#EA8C1F]",
        accent: "#EA8C1F",
        delta: deltas.claimants,
      },
      {
        id: "morbidity",
        label: t("overview.morbidityRate"),
        value: formatPct(kpis.morbidityRate * 100),
        icon: Activity,
        sublabel: t("overview.morbiditySub"),
        iconBg: "bg-[#FEF2F2]",
        iconColor: "text-[#DC2626]",
        dotColor: "bg-[#DC2626]",
        topBorder: "border-t-[#DC2626]",
        accent: "#DC2626",
        delta: deltas.morbidityRate,
      },
      {
        id: "transactions",
        label: t("overview.transactions"),
        value: formatNumber(kpis.transactions),
        icon: Receipt,
        sublabel: t("overview.transactionsSub"),
        iconBg: "bg-[#FFFBEB]",
        iconColor: "text-[#D9A400]",
        dotColor: "bg-[#D9A400]",
        topBorder: "border-t-[#D9A400]",
        accent: "#D9A400",
        delta: deltas.transactions,
      },
      {
        id: "healthcare",
        label: t("overview.healthcare"),
        value: formatNumber(kpis.healthcare),
        icon: Building2,
        sublabel: t("overview.healthcareSub"),
        iconBg: "bg-[#ECFDF5]",
        iconColor: "text-[#16A34A]",
        dotColor: "bg-[#16A34A]",
        topBorder: "border-t-[#16A34A]",
        accent: "#16A34A",
        delta: deltas.healthcare,
      },
      {
        id: "billing",
        label: t("overview.billingIdr"),
        value: formatIDR(kpis.billing),
        icon: Wallet,
        sublabel: t("overview.billingSub"),
        iconBg: "bg-[#FFF1F2]",
        iconColor: "text-[#9B2226]",
        dotColor: "bg-[#9B2226]",
        topBorder: "border-t-[#9B2226]",
        accent: "#9B2226",
        delta: deltas.billing,
        spark: monthly.map((m) => m.billing),
      },
      {
        id: "approved",
        label: t("overview.approvedIdr"),
        value: formatIDR(kpis.approved),
        icon: BadgeCheck,
        sublabel: `${formatRatioPct(kpis.approvedPct)} ${t("overview.ofBilling")}`,
        iconBg: "bg-[#F5F3FF]",
        iconColor: "text-[#7C3AED]",
        dotColor: "bg-[#7C3AED]",
        topBorder: "border-t-[#7C3AED]",
        accent: "#7C3AED",
        delta: deltas.approved,
        spark: monthly.map((m) => m.approved),
      },
    ],
    [t, kpis, deltas, monthly],
  );

  const benefitColumns: DataColumn<CoverageRow>[] = useMemo(
    () => [
      { key: "coverage", label: t("overview.coverage"), value: (r) => r.coverage },
      { key: "claimant", label: t("overview.claimant"), align: "right", value: (r) => r.claimants, render: (r) => formatNumber(r.claimants) },
      { key: "transaction", label: t("overview.transaction"), align: "right", value: (r) => r.transactions, render: (r) => formatNumber(r.transactions) },
      { key: "billing", label: t("overview.billingIdr"), align: "right", value: (r) => r.billing, render: (r) => formatIDR(r.billing) },
      { key: "approved", label: t("overview.approvedIdr"), align: "right", value: (r) => r.approved, render: (r) => formatIDR(r.approved) },
      { key: "unapproved", label: t("overview.unapprovedIdr"), align: "right", value: (r) => r.unapproved, render: (r) => formatIDR(r.unapproved) },
      {
        key: "pct",
        label: t("overview.pctApproved"),
        align: "right",
        value: (r) => r.approvedPct,
        render: (r) => formatRatioPct(r.approvedPct),
        progressOf: (r) => r.approvedPct,
      },
    ],
    [t],
  );

  const periode = "overview";

  const exportPayload = () => ({
    headers: [t("overview.coverage"), t("overview.claimant"), t("overview.transaction"), t("overview.billingIdr"), t("overview.approvedIdr"), t("overview.unapprovedIdr"), t("overview.pctApproved")],
    rows: [
      ...coverageRows.map((r) => [r.coverage, r.claimants, r.transactions, r.billing, r.approved, r.unapproved, formatRatioPct(r.approvedPct)] as (string | number)[]),
      [t("overview.total").toUpperCase(), kpis.claimants, kpis.transactions, kpis.billing, kpis.approved, kpis.unapproved, formatRatioPct(kpis.approvedPct)],
    ],
  });

  if (isError) return <ApiError onRetry={refetch} />;

  if (!isLoading && (filteredClaims?.length ?? 0) === 0) {
    return (
      <div className="flex h-full flex-col gap-3">
        <BoardHeader
          isFetching={isFetching}
          liveClock={liveClock}
          exportEnabled={exportEnabled}
          filename={`adbrief-overview-${periode}.csv`}
          getPayload={exportPayload}
        />
        <SectionCard title={t("overview.utilizationOverview")}>
          <EmptyState />
        </SectionCard>
      </div>
    );
  }

  return (
    <motion.div
      className="flex h-full flex-col gap-3 transition-opacity duration-300"
      style={{ opacity: isFetching && !isLoading ? 0.55 : 1 }}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      <BoardHeader
        isFetching={isFetching}
        liveClock={liveClock}
        exportEnabled={exportEnabled}
        filename={`adbrief-overview-${periode}.csv`}
        getPayload={exportPayload}
      />

      <motion.div variants={sectionVariants} className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((card, index) => {
          const IconComp = card.icon;
          const up = card.delta >= 0;
          const spark = "spark" in card ? card.spark : undefined;
          return (
            <motion.div
              key={card.id}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#E5E8EC] bg-white p-3.5 shadow-xs transition-all duration-200 hover:shadow-md",
                "border-t-[3px]",
                card.topBorder,
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
                  style={{ color: card.accent, opacity: 0.05 }}
                />
                <IconComp
                  strokeWidth={1.15}
                  className="relative h-full w-full"
                  style={{ color: card.accent, opacity: 0.11 }}
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
                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", card.iconBg)}>
                  <IconComp className={cn("h-3.5 w-3.5", card.iconColor)} strokeWidth={2.2} />
                </div>
                <span className="truncate text-[13px] font-extrabold uppercase tracking-wide text-[#1F2A37]">
                  {card.label}
                </span>
              </div>

              <div className="relative z-10 mt-2 flex items-end justify-between gap-2">
                <div className="min-w-0 font-display text-[18px] font-extrabold tabular-nums tracking-tight text-[#1F2A37] xl:text-[22px]">
                  <RollingCounter value={card.value} />
                </div>
                {spark && spark.length > 1 && (
                  <div className="h-7 w-16 shrink-0 opacity-70">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                        <Area type="monotone" dataKey="v" stroke={card.accent} strokeWidth={1.5} fill={card.accent} fillOpacity={0.15} isAnimationActive animationDuration={900} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="relative z-10 mt-1 flex items-center justify-between gap-1.5 text-[11px] font-medium text-[#9CA3AF]">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", card.dotColor)} />
                  <span className="truncate">{card.sublabel}</span>
                </span>
                <span className={cn("shrink-0 tabular-nums", up ? "text-[#16A34A]" : "text-[#DC2626]")}>
                  {up ? "↑" : "↓"} {formatPct(Math.abs(card.delta) * 100)}
                </span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Section 2 — ranking lists + interactive donut (Daily Monitoring chart language) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-5">
        <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-2">
          <SectionCard
            title={t("overview.patientDistribution")}
            className="h-full"
            bodyClassName="flex min-h-0 flex-col p-4"
            right={
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                {t("overview.servicesCount", { count: coverageRows.length })}
              </span>
            }
          >
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <div
                ref={trendScrollRef}
                onMouseEnter={() => setIsTrendPaused(true)}
                onMouseLeave={() => setIsTrendPaused(false)}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
              >
                {coverageRows.length > 0 ? (
                  coverageRows.map((row, i) => {
                    const pct = (row.claimants / maxCoverageClaimants) * 100;
                    return (
                      <div
                        key={row.coverage}
                        className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-[#E5E8EC] bg-white px-3.5 py-2.5 transition-all duration-150 hover:border-[#CBD5E1] hover:shadow-xs"
                      >
                        <div
                          className="pointer-events-none absolute inset-y-0 left-0 transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: `${SERVICES_RAMP[i % SERVICES_RAMP.length]}22` }}
                        />
                        <div className="relative flex min-w-0 items-center gap-2.5">
                          <RankBadge index={i} />
                          <span className="truncate text-[12px] font-bold text-[#1F2A37] transition-colors group-hover:text-[#2563EB]">
                            {row.coverage}
                          </span>
                        </div>
                        <div className="relative ml-3 flex shrink-0 items-center gap-2">
                          <span className="rounded-md border border-[#DBEAFE] bg-white/95 px-2 py-0.5 text-[12px] font-bold tabular-nums text-[#2563EB] shadow-2xs">
                            {formatNumber(row.claimants)}{" "}
                            <span className="text-[10px] font-normal text-[#6B7280]">{t("overview.claimantsLower")}</span>
                          </span>
                          <span className="w-12 text-right text-[11px] font-medium tabular-nums text-[#9CA3AF]">
                            {formatRatioPct(row.claimants / totalCoverageClaimants)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState message={t("overview.noCoverageData")} />
                )}
              </div>
            )}
          </SectionCard>
        </motion.div>

        <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-2">
          <SectionCard
            title={t("overview.billingDistribution")}
            className="h-full"
            bodyClassName="flex min-h-0 flex-col p-4"
            right={
              <span className="flex items-center gap-4 text-[11px] font-semibold text-white/90">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BILLING_YELLOW }} /> {t("overview.billingLabel")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: APPROVED_RED }} /> {t("overview.approvedLabel")}
                </span>
              </span>
            }
          >
            {isLoading ? (
              <ChartSkeleton height={240} />
            ) : (
              <div
                ref={billingScrollRef}
                onMouseEnter={() => setIsBillingPaused(true)}
                onMouseLeave={() => setIsBillingPaused(false)}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
              >
                {coverageRows.length > 0 ? (
                  coverageRows.map((row, i) => {
                    const pct = (row.billing / maxCoverageBilling) * 100;
                    return (
                      <div
                        key={row.coverage}
                        className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-[#E5E8EC] bg-white px-3.5 py-2.5 transition-all duration-150 hover:border-[#CBD5E1] hover:shadow-xs"
                      >
                        <div
                          className="pointer-events-none absolute inset-y-0 left-0 bg-[#FEF3C7]/80 transition-all duration-500 group-hover:bg-[#FDE68A]/70"
                          style={{ width: `${pct}%` }}
                        />
                        <div className="relative flex min-w-0 items-center gap-2.5">
                          <RankBadge index={i} />
                          <span className="truncate text-[12px] font-bold text-[#1F2A37] transition-colors group-hover:text-[#B45309]">
                            {row.coverage}
                          </span>
                        </div>
                        <div className="relative ml-3 flex shrink-0 items-center gap-2">
                          <span className="rounded-md border border-[#FDE68A] bg-white/95 px-2 py-0.5 text-[12px] font-bold tabular-nums text-[#B45309] shadow-2xs">
                            {formatCompactIDR(row.billing)}
                          </span>
                          <span className="rounded-md border border-[#FECDD3] bg-white/95 px-2 py-0.5 text-[12px] font-bold tabular-nums text-[#D64545] shadow-2xs">
                            {formatCompactIDR(row.approved)}
                          </span>
                          <span className="w-12 text-right text-[11px] font-medium tabular-nums text-[#9CA3AF]">
                            {formatRatioPct(row.billing / totalCoverageBilling)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState message={t("overview.noCoverageData")} />
                )}
              </div>
            )}
          </SectionCard>
        </motion.div>

        <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-1">
          <SectionCard
            title={t("overview.distributionPaymentType")}
            className="h-full"
            bodyClassName="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4"
          >
            {isLoading ? (
              <ChartSkeleton height={160} />
            ) : (
              <>
                <div className="relative h-[132px] w-[132px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="gradient-pay-cashless" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#60A5FA" />
                          <stop offset="100%" stopColor="#2563EB" />
                        </linearGradient>
                        <linearGradient id="gradient-pay-reimburse" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#FDE68A" />
                          <stop offset="100%" stopColor="#F2C230" />
                        </linearGradient>
                      </defs>
                      <Pie
                        data={payments}
                        dataKey="transactions"
                        nameKey="type"
                        innerRadius="64%"
                        outerRadius="86%"
                        paddingAngle={4}
                        cornerRadius={6}
                        startAngle={90}
                        endAngle={-270}
                        isAnimationActive
                        animationDuration={800}
                        onMouseEnter={(_, i) => setActiveSlice(i)}
                        onMouseLeave={() => setActiveSlice(null)}
                      >
                        {payments.map((p, i) => {
                          const theme = PAYMENT_THEME[p.type];
                          const isSelected = activeSlice === i;
                          const isDimmed = activeSlice !== null && !isSelected;
                          return (
                            <Cell
                              key={p.type}
                              fill={`url(#${theme.gradientId})`}
                              opacity={isDimmed ? 0.35 : 1}
                              style={{
                                transform: isSelected ? "scale(1.05)" : "scale(1)",
                                transformOrigin: "center",
                                transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                                cursor: "pointer",
                              }}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0].payload as (typeof payments)[number];
                          const theme = PAYMENT_THEME[p.type];
                          const label = p.type === "CASHLESS" ? t("overview.cashless") : t("overview.reimbursement");
                          return (
                            <div className="flex items-center gap-2.5 rounded-xl border border-[#E5E8EC] bg-white/95 px-3 py-2 text-[11px] font-medium shadow-lg backdrop-blur-xs">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: theme.solid }} />
                              <div className="flex flex-col">
                                <span className="font-bold text-[#1F2A37]">{label}</span>
                                <span className="text-[11px] text-[#4B5563]">
                                  {formatNumber(p.transactions)} {t("overview.transactions").toLowerCase()} ({formatRatioPct(p.share)})
                                </span>
                              </div>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center transition-all duration-200">
                    {activeSlice !== null && payments[activeSlice] ? (
                      <>
                        <span
                          className="text-[20px] font-extrabold tabular-nums tracking-tight"
                          style={{ color: PAYMENT_THEME[payments[activeSlice].type].solid }}
                        >
                          {formatNumber(payments[activeSlice].transactions)}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280]">
                          {formatRatioPct(payments[activeSlice].share)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[20px] font-extrabold tabular-nums tracking-tight text-[#1F2A37]">
                          {formatNumber(kpis.transactions)}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                          {t("overview.transactions")}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <ul className="flex min-h-0 w-full flex-1 flex-col justify-center gap-2">
                  {payments.map((p, i) => {
                    const theme = PAYMENT_THEME[p.type];
                    const isSelected = activeSlice === i;
                    const isDimmed = activeSlice !== null && !isSelected;
                    const label = p.type === "CASHLESS" ? t("overview.cashless") : t("overview.reimbursement");
                    return (
                      <li
                        key={p.type}
                        onMouseEnter={() => setActiveSlice(i)}
                        onMouseLeave={() => setActiveSlice(null)}
                        className={cn(
                          "group flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-all duration-200",
                          isSelected
                            ? cn(theme.bgLight, theme.borderLight, "shadow-xs")
                            : "border-[#E5E8EC] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]",
                          isDimmed && "opacity-40",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full transition-transform duration-200 group-hover:scale-125"
                            style={{
                              background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                              boxShadow: isSelected ? `0 0 8px ${theme.solid}66` : undefined,
                            }}
                          />
                          <span className="truncate text-[12px] font-bold text-[#1F2A37]">{label}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[12px] font-bold tabular-nums text-[#1F2A37]">{formatNumber(p.transactions)}</span>
                          <span
                            className={cn(
                              "min-w-[46px] rounded-md px-1.5 py-0.5 text-right text-[11px] font-bold tabular-nums",
                              isSelected ? cn(theme.badgeBg, theme.badgeText) : "bg-[#F3F4F6] text-[#4B5563] group-hover:bg-[#E5E7EB]",
                            )}
                          >
                            {formatRatioPct(p.share)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </SectionCard>
        </motion.div>
      </div>

      {/* Section 3 — original channel table + benefit utilization */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-5">
        <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-2">
          <SectionCard title={t("overview.nonProviderVsProvider")} className="h-full" bodyClassName="flex min-h-0 flex-col justify-start p-4">
            {isLoading ? (
              <ChartSkeleton height={140} />
            ) : (
              <DataTable
                sortable={false}
                className="min-h-0 flex-1"
                rowKey={(r) => r.channel}
                columns={[
                  { key: "channel", label: t("overview.channel"), value: (r) => r.channel, render: (r) => r.channel.includes("Non") ? t("overview.nonProviderReimburse") : t("overview.providerInNetwork") },
                  { key: "claimant", label: t("overview.claimant"), align: "right", value: (r) => r.claimants, render: (r) => formatNumber(r.claimants) },
                  { key: "billing", label: t("overview.billingIdr"), align: "right", value: (r) => r.billing, render: (r) => formatIDR(r.billing) },
                  { key: "approved", label: t("overview.approvedIdr"), align: "right", value: (r) => r.approved, render: (r) => formatIDR(r.approved) },
                  {
                    key: "pct",
                    label: t("overview.pctApproved"),
                    align: "right",
                    value: (r) => r.approvedPct,
                    render: (r) => formatRatioPct(r.approvedPct),
                    progressOf: (r) => r.approvedPct,
                  },
                ]}
                rows={channels}
                footer={[
                  t("overview.total"),
                  formatNumber(kpis.claimants),
                  formatIDR(kpis.billing),
                  formatIDR(kpis.approved),
                  formatRatioPct(kpis.approvedPct),
                ]}
              />
            )}
          </SectionCard>
        </motion.div>

        <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-3">
          <SectionCard title={t("overview.benefitUtilization")} className="h-full" bodyClassName="flex min-h-0 flex-col p-4">
            {isLoading ? (
              <ChartSkeleton height={240} />
            ) : (
              <>
                <DataTable
                  className="min-h-0 flex-1"
                  columns={benefitColumns}
                  rows={coverageRows}
                  rowKey={(r) => r.coverage}
                  footer={[
                    t("overview.total"),
                    `${formatNumber(kpis.claimants)}`,
                    formatNumber(kpis.transactions),
                    formatIDR(kpis.billing),
                    formatIDR(kpis.approved),
                    formatIDR(kpis.unapproved),
                    formatRatioPct(kpis.approvedPct),
                  ]}
                />
                <p className="mt-1.5 shrink-0 text-[11.5px] italic text-[#9CA3AF]">
                  {t("overview.footnoteClaimant")}
                </p>
              </>
            )}
          </SectionCard>
        </motion.div>
      </div>
    </motion.div>
  );
}

function BoardHeader({
  isFetching,
  liveClock,
  exportEnabled,
  filename,
  getPayload,
}: {
  isFetching: boolean;
  liveClock: string;
  exportEnabled: boolean;
  filename: string;
  getPayload: () => { headers: string[]; rows: (string | number)[][] };
}) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="font-display text-[24px] font-extrabold text-[#1F2A37] md:text-[28px]">{t("overview.title")}</h1>
        <p className="mt-0.5 text-[13px] italic text-[#9CA3AF]">{t("overview.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <PeriodFilter isFetching={isFetching} liveClock={liveClock} />
        {exportEnabled && (
          <>
            <div className="hidden w-px self-stretch bg-[#E5E8EC] md:block" />
            <ExportButton filename={filename} getPayload={getPayload} />
          </>
        )}
      </div>
    </div>
  );
}
