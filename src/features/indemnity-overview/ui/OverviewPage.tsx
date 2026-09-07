/**
 * Indemnity — Utilization Overview
 *
 * Migrated from the original Overview page to use RTK Query data
 * instead of FilterProvider. All business logic (aggregation, KPIs,
 * charts, tables) is preserved exactly.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import KpiCard from "@/shared/components/common/KpiCard";
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

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <Skeleton className="w-full" style={{ height }} />;
}

export default function Overview() {
  const { t } = useTranslation();
  const { data, isLoading, isFetching, lastUpdated, isError, refetch } = useIndemnityData();
  const exportEnabled = useExportEnabled();

  const filteredClaims = data?.claims ?? [];
  const members = data?.members ?? [];
  const providers = data?.providers ?? [];

  const kpis = useMemo(() => kpiSummary(filteredClaims, members), [filteredClaims, members]);
  const deltas = useMemo(() => kpiDeltas(filteredClaims, members), [filteredClaims, members]);
  const coverageRows = useMemo(() => byCoverage(filteredClaims), [filteredClaims]);
  const monthly = useMemo(() => byMonth(filteredClaims), [filteredClaims]);
  const channels = useMemo(() => providerSplit(filteredClaims, providers), [filteredClaims, providers]);
  const payments = useMemo(() => paymentSplit(filteredClaims), [filteredClaims]);

  const totalCoverageClaimants = kpis.claimants || 1;
  const [activeSlice, setActiveSlice] = useState<number | null>(null);

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
                  filename={`adbrief-overview-${periode}.csv`}
                  getPayload={() => ({
                    headers: [t("overview.coverage"), t("overview.claimant"), t("overview.transaction"), t("overview.billingIdr"), t("overview.approvedIdr"), t("overview.unapprovedIdr"), t("overview.pctApproved")],
                    rows: [
                      ...coverageRows.map((r) => [r.coverage, r.claimants, r.transactions, r.billing, r.approved, r.unapproved, formatRatioPct(r.approvedPct)] as (string | number)[]),
                      [t("overview.total").toUpperCase(), kpis.claimants, kpis.transactions, kpis.billing, kpis.approved, kpis.unapproved, formatRatioPct(kpis.approvedPct)],
                    ],
                  })}
                />
              </div>
            )}
          </div>
        </div>
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <PageTitle />
        <div className="flex items-center justify-end gap-2">
          <PeriodFilter isFetching={isFetching} lastUpdated={lastUpdated} />
          {exportEnabled && (
            <>
              <div className="w-px self-stretch bg-[#E5E8EC]" />
              <ExportButton
                filename={`adbrief-overview-${periode}.csv`}
                getPayload={() => ({
                  headers: [t("overview.coverage"), t("overview.claimant"), t("overview.transaction"), t("overview.billingIdr"), t("overview.approvedIdr"), t("overview.unapprovedIdr"), t("overview.pctApproved")],
                  rows: [
                    ...coverageRows.map((r) => [r.coverage, r.claimants, r.transactions, r.billing, r.approved, r.unapproved, formatRatioPct(r.approvedPct)] as (string | number)[]),
                    [t("overview.total").toUpperCase(), kpis.claimants, kpis.transactions, kpis.billing, kpis.approved, kpis.unapproved, formatRatioPct(kpis.approvedPct)],
                  ],
                })}
              />
            </>
          )}
        </div>
      </div>

      {/* Section 1 — KPI row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard index={0} loading={isLoading} label={t("overview.memberActive")} accent="#2563EB" value={kpis.memberActive} format={formatNumber} delta={deltas.memberActive} />
          <KpiCard index={1} loading={isLoading} label={t("overview.claimants")} accent="#EA8C1F" value={kpis.claimants} format={formatNumber} delta={deltas.claimants} />
          <KpiCard index={2} loading={isLoading} label={t("overview.morbidityRate")} accent="#DC2626" value={kpis.morbidityRate * 100} format={formatPct} delta={deltas.morbidityRate} />
          <KpiCard index={3} loading={isLoading} label={t("overview.transactions")} accent="#D9A400" value={kpis.transactions} format={formatNumber} delta={deltas.transactions} />
          <KpiCard index={4} loading={isLoading} label={t("overview.healthcare")} accent="#16A34A" value={kpis.healthcare} format={formatNumber} delta={deltas.healthcare} />
          <KpiCard index={5} loading={isLoading} label={t("overview.billingIdr")} accent="#9B2226" value={kpis.billing} format={formatIDR} delta={deltas.billing} spark={monthly.map((m) => m.billing)} />
          <KpiCard
            index={6}
            loading={isLoading}
            label={t("overview.approvedIdr")}
            accent="#7C3AED"
            value={kpis.approved}
            format={formatIDR}
            delta={deltas.approved}
            subline={`${formatRatioPct(kpis.approvedPct)} ${t("overview.ofBilling")}`}
            spark={monthly.map((m) => m.approved)}
          />
        </div>

        {/* ── Section 2 — Distribution group (1 row, 3 cols) ── */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-5">
          {/* 2a: Patient Distribution by Type of Services */}
          <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-2">
            <SectionCard title={t("overview.patientDistribution")} className="h-full" bodyClassName="flex flex-col p-4">
              {isLoading ? (
                <ChartSkeleton />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <div className="min-h-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={coverageRows} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }} barCategoryGap="28%">
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="coverage"
                          width={64}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fontWeight: 600, fill: "#4B5563" }}
                        />
                        <Tooltip
                          cursor={{ fill: "rgba(63,163,122,0.06)" }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const row = payload[0].payload as CoverageRow;
                            return (
                              <div className="rounded-lg border border-[#E5E8EC] bg-white px-3 py-2 text-[11px] font-medium shadow-md">
                                {row.coverage} — {formatNumber(row.claimants)} {t("overview.claimants").toLowerCase()} ({formatRatioPct(row.claimants / totalCoverageClaimants)} {t("overview.ofClaimants").toLowerCase()})
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="claimants" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={700}>
                          {coverageRows.map((row, i) => (
                            <Cell key={row.coverage} fill={SERVICES_RAMP[i % SERVICES_RAMP.length]} />
                          ))}
                          <LabelList dataKey="claimants" position="right" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 11, fontWeight: 700, fill: "#1F2A37" }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="min-h-0 flex-1 divide-y divide-[#E5E8EC] overflow-y-auto">
                    {coverageRows.map((row, i) => (
                      <li key={row.coverage} className="flex items-center gap-2 py-1">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SERVICES_RAMP[i % SERVICES_RAMP.length] }} />
                        <span className="text-[11.5px] font-semibold text-[#1F2A37]">{row.coverage}</span>
                        <span className="ml-auto text-[11.5px] font-bold text-[#1F2A37] tabular-nums">{formatNumber(row.claimants)}</span>
                        <span className="w-14 text-right text-[11px] font-medium text-[#9CA3AF] tabular-nums">
                          {formatRatioPct(row.claimants / totalCoverageClaimants)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          </motion.div>

          {/* 2b: Billing Distribution */}
          <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-2">
            <SectionCard
              title={t("overview.billingDistribution")}
              className="h-full"
              bodyClassName="flex flex-col p-4"
              right={
                <span className="flex items-center gap-4 text-[11px] font-semibold text-white/90">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BILLING_YELLOW }} /> {t("overview.billing")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: APPROVED_RED }} /> {t("overview.approved")}
                  </span>
                </span>
              }
            >
              {isLoading ? (
                <ChartSkeleton height={240} />
              ) : (
                <div className="min-h-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={coverageRows} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }} barCategoryGap="22%" barGap={3}>
                      <XAxis type="number" tickFormatter={(v: number) => formatCompactIDR(v)} tick={{ fontSize: 10.5, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="coverage" width={64} tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: "#4B5563" }} />
                      <Tooltip
                        cursor={{ fill: "rgba(63,163,122,0.06)" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0].payload as CoverageRow;
                          return (
                            <div className="rounded-lg border border-[#E5E8EC] bg-white px-3 py-2 text-[11px] font-medium shadow-md">
                              {row.coverage} · {t("overview.billing")}: {t("overview.idr")} {formatIDR(row.billing)} · {t("overview.approved")}: {t("overview.idr")} {formatIDR(row.approved)} ({formatRatioPct(row.approvedPct)})
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="billing" name={t("overview.billing")} fill={BILLING_YELLOW} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={700} />
                      <Bar dataKey="approved" name={t("overview.approved")} fill={APPROVED_RED} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={700} animationBegin={100}>
                        <LabelList
                          dataKey="approvedPct"
                          position="right"
                          formatter={(v: number) => formatRatioPct(v)}
                          style={{ fontSize: 10.5, fontWeight: 700, fill: "#2E7D5B" }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>
          </motion.div>

          {/* 2c: Distribution Payment Type (donut) */}
          <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-1">
            <SectionCard title={t("overview.distributionPaymentType")} className="h-full" bodyClassName="flex flex-col p-4">
              {isLoading ? (
                <ChartSkeleton height={160} />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col items-center gap-2">
                  <div className="relative h-[140px] w-[140px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie
                          data={payments}
                          dataKey="transactions"
                          nameKey="type"
                          innerRadius="58%"
                          outerRadius="85%"
                          startAngle={90}
                          endAngle={-270}
                          isAnimationActive
                          animationDuration={800}
                          onMouseEnter={(_, i) => setActiveSlice(i)}
                          onMouseLeave={() => setActiveSlice(null)}
                        >
                          {payments.map((p, i) => (
                            <Cell
                              key={p.type}
                              fill={p.type === "CASHLESS" ? "#2563EB" : BILLING_YELLOW}
                              opacity={activeSlice === null || activeSlice === i ? 1 : 0.4}
                              style={{ transform: activeSlice === i ? "scale(1.03)" : "scale(1)", transformOrigin: "center", transition: "all 150ms" }}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const p = payload[0].payload as (typeof payments)[number];
                            return (
                              <div className="rounded-lg border border-[#E5E8EC] bg-white px-3 py-2 text-[11px] font-medium shadow-md">
                                {p.type === "CASHLESS" ? t("overview.cashless") : t("overview.reimbursement")} — {formatNumber(p.transactions)} {t("overview.transactions").toLowerCase()} ({formatRatioPct(p.share)})
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[18px] font-extrabold text-[#1F2A37] tabular-nums">{formatNumber(kpis.transactions)}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[#9CA3AF]">{t("overview.transactions")}</span>
                    </div>
                  </div>
                  <ul className="flex w-full min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
                    {payments.map((p) => (
                      <motion.li
                        key={p.type}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.25 }}
                        className="flex items-center gap-2.5 rounded-lg border border-[#E5E8EC] px-2.5 py-2"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.type === "CASHLESS" ? "#2563EB" : BILLING_YELLOW }} />
                        <span className="text-[11.5px] font-bold text-[#1F2A37]">{p.type === "CASHLESS" ? t("overview.cashless") : t("overview.reimbursement")}</span>
                        <span className="ml-auto text-[11.5px] font-semibold text-[#4B5563] tabular-nums">{formatNumber(p.transactions)}</span>
                        <span className="w-16 text-right text-[11.5px] font-bold text-[#1F2A37] tabular-nums">{formatRatioPct(p.share)}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          </motion.div>
        </div>

        {/* ── Section 3 — Channel table & Benefit utilization ── */}
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

function PageTitle() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="font-display text-[24px] font-extrabold text-[#1F2A37] md:text-[28px]">{t("overview.title")}</h1>
      <p className="mt-0.5 text-[13px] italic text-[#9CA3AF]">
        {t("overview.subtitle")}
      </p>
    </div>
  );
}