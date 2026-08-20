/**
 * Indemnity — Utilization Overview
 *
 * Migrated from the original Overview page to use RTK Query data
 * instead of FilterProvider. All business logic (aggregation, KPIs,
 * charts, tables) is preserved exactly.
 */
import { useMemo, useState } from "react";
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
import { FileDown } from "lucide-react";
import KpiCard from "@/shared/components/common/KpiCard";
import SectionCard from "@/shared/components/common/SectionCard";
import DataTable from "@/shared/components/common/DataTable";
import type { DataColumn } from "@/shared/components/common/DataTable";
import ExportButton from "@/shared/components/common/ExportButton";
import EmptyState from "@/shared/components/common/EmptyState";
import ApiError from "@/shared/components/error/ApiError";
import { Button } from "@/shared/ui/button";
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
  const { data, isLoading, isFetching, lastUpdated, isError, refetch } = useIndemnityData();

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
      { key: "coverage", label: "Coverage", value: (r) => r.coverage },
      { key: "claimant", label: "Claimant", align: "right", value: (r) => r.claimants, render: (r) => formatNumber(r.claimants) },
      { key: "transaction", label: "Transaction", align: "right", value: (r) => r.transactions, render: (r) => formatNumber(r.transactions) },
      { key: "billing", label: "Billing (IDR)", align: "right", value: (r) => r.billing, render: (r) => formatIDR(r.billing) },
      { key: "approved", label: "Approved (IDR)", align: "right", value: (r) => r.approved, render: (r) => formatIDR(r.approved) },
      {
        key: "pct",
        label: "%Approved",
        align: "right",
        value: (r) => r.approvedPct,
        render: (r) => formatRatioPct(r.approvedPct),
        progressOf: (r) => r.approvedPct,
      },
    ],
    [],
  );

  if (isError) return <ApiError onRetry={refetch} />;

  if (!isLoading && filteredClaims.length === 0) {
    return (
      <div className="space-y-6">
        <PageTitle />
        <PeriodFilter isFetching={isFetching} lastUpdated={lastUpdated} />
        <SectionCard title="Utilization Overview">
          <EmptyState />
        </SectionCard>
      </div>
    );
  }

  const periode = "overview";

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      <PageTitle />
      <PeriodFilter isFetching={isFetching} lastUpdated={lastUpdated} />

      {/* Content area — subtle dim during background refetch (not initial load) */}
      <div
        className="space-y-6 transition-opacity duration-300"
        style={{ opacity: isFetching && !isLoading ? 0.55 : 1 }}
      >
      {/* Section 1 — KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard index={0} loading={isLoading} label="Member Active" accent="#2563EB" value={kpis.memberActive} format={formatNumber} delta={deltas.memberActive} />
        <KpiCard index={1} loading={isLoading} label="Claimants" accent="#EA8C1F" value={kpis.claimants} format={formatNumber} delta={deltas.claimants} />
        <KpiCard index={2} loading={isLoading} label="Morbidity Rate" accent="#DC2626" value={kpis.morbidityRate * 100} format={formatPct} delta={deltas.morbidityRate} />
        <KpiCard index={3} loading={isLoading} label="Transactions" accent="#D9A400" value={kpis.transactions} format={formatNumber} delta={deltas.transactions} />
        <KpiCard index={4} loading={isLoading} label="Healthcare" accent="#16A34A" value={kpis.healthcare} format={formatNumber} delta={deltas.healthcare} />
        <KpiCard index={5} loading={isLoading} label="Billing (IDR)" accent="#9B2226" value={kpis.billing} format={formatIDR} delta={deltas.billing} spark={monthly.map((m) => m.billing)} />
        <KpiCard
          index={6}
          loading={isLoading}
          label="Approved (IDR)"
          accent="#7C3AED"
          value={kpis.approved}
          format={formatIDR}
          delta={deltas.approved}
          subline={`${formatRatioPct(kpis.approvedPct)} of billing`}
          spark={monthly.map((m) => m.approved)}
        />
      </div>

      {/* Section 2 — Patient Distribution by Type of Services */}
      <motion.div variants={sectionVariants}>
        <SectionCard title="Patient Distribution by Type of Services">
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={coverageRows} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }} barCategoryGap="28%">
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="coverage"
                      width={64}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fontWeight: 600, fill: "#4B5563" }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(63,163,122,0.06)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as CoverageRow;
                        return (
                          <div className="rounded-lg border border-[#E5E8EC] bg-white px-3 py-2 text-[12px] font-medium shadow-md">
                            {row.coverage} — {formatNumber(row.claimants)} claimants ({formatRatioPct(row.claimants / totalCoverageClaimants)} of claimants)
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="claimants" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={700}>
                      {coverageRows.map((row, i) => (
                        <Cell key={row.coverage} fill={SERVICES_RAMP[i % SERVICES_RAMP.length]} />
                      ))}
                      <LabelList dataKey="claimants" position="right" formatter={(v: number) => formatNumber(v)} style={{ fontSize: 12, fontWeight: 700, fill: "#1F2A37" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="lg:col-span-2">
                <ul className="divide-y divide-[#E5E8EC]">
                  {coverageRows.map((row, i) => (
                    <li key={row.coverage} className="flex items-center gap-3 py-2.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: SERVICES_RAMP[i % SERVICES_RAMP.length] }} />
                      <span className="text-[13px] font-semibold text-[#1F2A37]">{row.coverage}</span>
                      <span className="ml-auto text-[13px] font-bold text-[#1F2A37] tabular-nums">{formatNumber(row.claimants)}</span>
                      <span className="w-16 text-right text-[12px] font-medium text-[#9CA3AF] tabular-nums">
                        {formatRatioPct(row.claimants / totalCoverageClaimants)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* Section 3 — Billing Distribution */}
      <motion.div variants={sectionVariants}>
        <SectionCard
          title="Billing Distribution"
          right={
            <span className="flex items-center gap-4 text-[11px] font-semibold text-white/90">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BILLING_YELLOW }} /> Billing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: APPROVED_RED }} /> Approved
              </span>
            </span>
          }
        >
          {isLoading ? (
            <ChartSkeleton height={320} />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={coverageRows} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 8 }} barCategoryGap="22%" barGap={3}>
                <XAxis type="number" tickFormatter={(v: number) => formatCompactIDR(v)} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="coverage" width={64} tickLine={false} axisLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: "#4B5563" }} />
                <Tooltip
                  cursor={{ fill: "rgba(63,163,122,0.06)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as CoverageRow;
                    return (
                      <div className="rounded-lg border border-[#E5E8EC] bg-white px-3 py-2 text-[12px] font-medium shadow-md">
                        {row.coverage} · Billing: IDR {formatIDR(row.billing)} · Approved: IDR {formatIDR(row.approved)} ({formatRatioPct(row.approvedPct)})
                      </div>
                    );
                  }}
                />
                <Bar dataKey="billing" name="Billing" fill={BILLING_YELLOW} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={700} />
                <Bar dataKey="approved" name="Approved" fill={APPROVED_RED} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={700} animationBegin={100}>
                  <LabelList
                    dataKey="approvedPct"
                    position="right"
                    formatter={(v: number) => formatRatioPct(v)}
                    style={{ fontSize: 11, fontWeight: 700, fill: "#2E7D5B" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </motion.div>

      {/* Sections 4 + 6 — channel table & payment donut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div variants={sectionVariants}>
          <SectionCard title="Non Provider vs Provider" className="h-full">
            {isLoading ? (
              <ChartSkeleton height={180} />
            ) : (
              <DataTable
                sortable={false}
                rowKey={(r) => r.channel}
                columns={[
                  { key: "channel", label: "Channel", value: (r) => r.channel },
                  { key: "claimant", label: "Claimant", align: "right", value: (r) => r.claimants, render: (r) => formatNumber(r.claimants) },
                  { key: "billing", label: "Billing (IDR)", align: "right", value: (r) => r.billing, render: (r) => formatIDR(r.billing) },
                  { key: "approved", label: "Approved (IDR)", align: "right", value: (r) => r.approved, render: (r) => formatIDR(r.approved) },
                  {
                    key: "pct",
                    label: "%Approved",
                    align: "right",
                    value: (r) => r.approvedPct,
                    render: (r) => formatRatioPct(r.approvedPct),
                    progressOf: (r) => r.approvedPct,
                  },
                ]}
                rows={channels}
                footer={[
                  "Total",
                  formatNumber(kpis.claimants),
                  formatIDR(kpis.billing),
                  formatIDR(kpis.approved),
                  formatRatioPct(kpis.approvedPct),
                ]}
              />
            )}
          </SectionCard>
        </motion.div>

        <motion.div variants={sectionVariants}>
          <SectionCard title="Distribution Payment Type" className="h-full">
            {isLoading ? (
              <ChartSkeleton height={220} />
            ) : (
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className="relative h-[220px] w-[220px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
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
                            <div className="rounded-lg border border-[#E5E8EC] bg-white px-3 py-2 text-[12px] font-medium shadow-md">
                              {p.type} — {formatNumber(p.transactions)} transactions ({formatRatioPct(p.share)})
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[26px] font-extrabold text-[#1F2A37] tabular-nums">{formatNumber(kpis.transactions)}</span>
                    <span className="text-[10.5px] font-bold uppercase tracking-wide text-[#9CA3AF]">Transactions</span>
                  </div>
                </div>
                <ul className="w-full space-y-3">
                  {payments.map((p) => (
                    <motion.li
                      key={p.type}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3, duration: 0.25 }}
                      className="flex items-center gap-3 rounded-lg border border-[#E5E8EC] px-4 py-3"
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.type === "CASHLESS" ? "#2563EB" : BILLING_YELLOW }} />
                      <span className="text-[13px] font-bold text-[#1F2A37]">{p.type}</span>
                      <span className="ml-auto text-[13px] font-semibold text-[#4B5563] tabular-nums">{formatNumber(p.transactions)}</span>
                      <span className="w-16 text-right text-[13px] font-bold text-[#1F2A37] tabular-nums">{formatRatioPct(p.share)}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>
        </motion.div>
      </div>

      {/* Section 5 — Benefit utilization table */}
      <motion.div variants={sectionVariants}>
        <SectionCard title="Overview Benefit Utilization by Type of Services">
          {isLoading ? (
            <ChartSkeleton height={300} />
          ) : (
            <>
              <DataTable
                columns={benefitColumns}
                rows={coverageRows}
                rowKey={(r) => r.coverage}
                footer={[
                  "Total",
                  `${formatNumber(kpis.claimants)}*`,
                  formatNumber(kpis.transactions),
                  formatIDR(kpis.billing),
                  formatIDR(kpis.approved),
                  formatRatioPct(kpis.approvedPct),
                ]}
              />
              <p className="mt-2 text-[11.5px] italic text-[#9CA3AF]">
                *Total Claimant is distinct members across all services; a claimant may use multiple service types.
              </p>
            </>
          )}
        </SectionCard>
      </motion.div>

      {/* Section 7 — Export row */}
      <motion.div variants={sectionVariants} className="flex items-center justify-end gap-3">
        <Button variant="ghost" disabled title="Export PDF — coming soon" className="gap-2 text-[#9CA3AF]">
          <FileDown className="h-4 w-4" />
          Export PDF (soon)
        </Button>
        <ExportButton
          filename={`adbrief-overview-${periode}.csv`}
          getPayload={() => ({
            headers: ["Coverage", "Claimant", "Transaction", "Billing (IDR)", "Approved (IDR)", "%Approved"],
            rows: [
              ...coverageRows.map((r) => [r.coverage, r.claimants, r.transactions, r.billing, r.approved, formatRatioPct(r.approvedPct)] as (string | number)[]),
              ["TOTAL", kpis.claimants, kpis.transactions, kpis.billing, kpis.approved, formatRatioPct(kpis.approvedPct)],
            ],
          })}
        />
      </motion.div>
      </div>
    </motion.div>
  );
}

function PageTitle() {
  return (
    <div>
      <h1 className="font-display text-[28px] font-extrabold text-[#1F2A37] md:text-[32px]">Utilization Overview</h1>
      <p className="mt-1 text-sm italic text-[#9CA3AF]">
        Summary of member utilization, service mix, and claim value for the selected period
      </p>
    </div>
  );
}