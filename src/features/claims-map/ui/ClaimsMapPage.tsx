/**
 * Indemnity — Claims Map (Where Claimants Made Claims)
 *
 * Migrated from the original ClaimsMap page to use RTK Query data.
 * All business logic (aggregation, KPIs, charts, map, tables) preserved.
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Search, X } from "lucide-react";
import KpiCard from "@/shared/components/common/KpiCard";
import SectionCard from "@/shared/components/common/SectionCard";
import DataTable from "@/shared/components/common/DataTable";
import type { DataColumn } from "@/shared/components/common/DataTable";
import ExportButton from "@/shared/components/common/ExportButton";
import EmptyState from "@/shared/components/common/EmptyState";
import ApiError from "@/shared/components/error/ApiError";
import IndonesiaMap, { MAP_METRIC_OPTIONS } from "@/features/claims-map/components/IndonesiaMap";
import type { MapMetric } from "@/features/claims-map/components/IndonesiaMap";
import { Skeleton } from "@/shared/ui/skeleton";
import { useIndemnityData } from "@/features/indemnity-overview/hooks/useIndemnityData";
import PeriodFilter from "@/features/indemnity-overview/components/PeriodFilter";
import { byCity, byMonth, byProvider, byProvince, kpiDeltas, kpiSummary } from "@/entities/claim/lib/aggregate";
import type { CityRow, MonthRow, ProviderRow } from "@/entities/claim/lib/aggregate";
import { cn } from "@/shared/lib/utils";
import { formatCompactIDR, formatIDR, formatMonthShort, formatNumber, formatRatioPct } from "@/shared/lib/format";

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

const BILLING_RED = "#D64545";
const APPROVED_YELLOW = "#F2C230";
const CLAIMANT_BLUE = "#2563EB";

const formatDecimal = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-56 rounded-md border border-[#E5E8EC] pl-8 pr-3 text-[12.5px] font-medium text-[#1F2A37] outline-none placeholder:text-[#9CA3AF] focus:border-[#3FA37A] focus:ring-2 focus:ring-[#3FA37A]/20"
      />
    </div>
  );
}

export default function ClaimsMap() {
  const { data, isLoading, isError, refetch } = useIndemnityData();

  const filteredClaims = data?.claims ?? [];
  const members = data?.members ?? [];
  const providers = data?.providers ?? [];

  const kpis = useMemo(() => kpiSummary(filteredClaims, members), [filteredClaims, members]);
  const deltas = useMemo(() => kpiDeltas(filteredClaims, members), [filteredClaims, members]);
  const monthly = useMemo(() => byMonth(filteredClaims), [filteredClaims]);
  const cities = useMemo(() => byCity(filteredClaims, providers), [filteredClaims, providers]);
  const providerRows = useMemo(() => byProvider(filteredClaims, providers), [filteredClaims, providers]);
  const provinceMap = useMemo(() => byProvince(filteredClaims, providers), [filteredClaims, providers]);

  const [metric, setMetric] = useState<MapMetric>("claimants");
  const [pinned, setPinned] = useState<string | null>(null);
  const [lineMetric, setLineMetric] = useState<"claimants" | "transactions">("claimants");
  const [citySearch, setCitySearch] = useState("");
  const [providerSearch, setProviderSearch] = useState("");
  const [showAllProviders, setShowAllProviders] = useState(false);

  const visibleCities = useMemo(() => {
    let rows = cities;
    if (pinned) rows = rows.filter((r) => r.province === pinned);
    if (citySearch.trim()) rows = rows.filter((r) => r.city.toLowerCase().includes(citySearch.trim().toLowerCase()));
    return rows;
  }, [cities, pinned, citySearch]);

  const visibleProviders = useMemo(() => {
    let rows = providerRows;
    if (providerSearch.trim()) rows = rows.filter((r) => r.providerName.toLowerCase().includes(providerSearch.trim().toLowerCase()));
    return showAllProviders ? rows : rows.slice(0, 25);
  }, [providerRows, providerSearch, showAllProviders]);

  const avgApprovedCity = (r: CityRow) => (r.claimants ? r.approved / r.claimants : 0);

  const cityColumns: DataColumn<CityRow>[] = useMemo(
    () => [
      { key: "city", label: "City", value: (r) => r.city, render: (r) => <span className="font-semibold">{r.city}</span> },
      { key: "transaction", label: "Transaction", align: "right", value: (r) => r.transactions, render: (r) => formatNumber(r.transactions) },
      { key: "claimant", label: "Claimant", align: "right", value: (r) => r.claimants, render: (r) => formatNumber(r.claimants) },
      { key: "billing", label: "Billing (IDR)", align: "right", value: (r) => r.billing, render: (r) => formatIDR(r.billing) },
      { key: "approved", label: "Approved (IDR)", align: "right", value: (r) => r.approved, render: (r) => formatIDR(r.approved) },
      {
        key: "pct",
        label: "%Approved",
        align: "right",
        value: (r) => (r.billing ? r.approved / r.billing : 0),
        render: (r) => formatRatioPct(r.billing ? r.approved / r.billing : 0),
        progressOf: (r) => (r.billing ? r.approved / r.billing : 0),
      },
      { key: "avg", label: "Avg. Approved Bills / Claimant (IDR)", align: "right", value: avgApprovedCity, render: (r) => formatIDR(avgApprovedCity(r)) },
    ],
    [],
  );

  const providerColumns: DataColumn<ProviderRow>[] = useMemo(
    () => [
      {
        key: "provider",
        label: "Provider Name",
        value: (r) => r.providerName,
        render: (r) => (
          <span className="flex items-center gap-2">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-[#4B5563]">{r.type}</span>
            <span className="font-semibold">{r.providerName}</span>
            {!r.inNetwork && <span className="rounded bg-[#F2C230]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#8a6d00]">Non Provider</span>}
          </span>
        ),
      },
      { key: "transaction", label: "Transaction", align: "right", value: (r) => r.transactions, render: (r) => formatNumber(r.transactions) },
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
      {
        key: "avg",
        label: "Avg. Approved Bills / Claimant (IDR)",
        align: "right",
        value: (r) => (r.claimants ? r.approved / r.claimants : 0),
        render: (r) => formatIDR(r.claimants ? r.approved / r.claimants : 0),
      },
    ],
    [],
  );

  if (isError) return <ApiError onRetry={refetch} />;

  if (!isLoading && filteredClaims.length === 0) {
    return (
      <div className="space-y-6">
        <PageTitle />
        <PeriodFilter />
        <SectionCard title="Where Claimants Made Claims">
          <EmptyState />
        </SectionCard>
      </div>
    );
  }

  const periode = "claims-map";

  const chartData = monthly.map((m: MonthRow) => ({
    ...m,
    label: formatMonthShort(m.month).replace(" ", " '").slice(0, 7),
  }));

  return (
    <motion.div className="space-y-6" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
      <PageTitle />
      <PeriodFilter />

      {/* Section 1 — KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard index={0} loading={isLoading} label="Claimants" accent="#EA8C1F" value={kpis.claimants} format={formatNumber} delta={deltas.claimants} />
        <KpiCard index={1} loading={isLoading} label="Transactions" accent="#D9A400" value={kpis.transactions} format={formatNumber} delta={deltas.transactions} />
        <KpiCard index={2} loading={isLoading} label="Healthcare" accent="#16A34A" value={kpis.healthcare} format={formatNumber} delta={deltas.healthcare} />
        <KpiCard index={3} loading={isLoading} label="Avg. Transactions / Claimant" accent="#2563EB" value={kpis.avgTxnPerClaimant} format={formatDecimal} />
        <KpiCard index={4} loading={isLoading} label="Avg. Approved / Claimant (IDR)" accent="#7C3AED" value={kpis.avgApprovedPerClaimant} format={formatIDR} />
        <KpiCard index={5} loading={isLoading} label="Billing (IDR)" accent="#9B2226" value={kpis.billing} format={formatIDR} delta={deltas.billing} spark={monthly.map((m) => m.billing)} />
        <KpiCard index={6} loading={isLoading} label="Approved (IDR)" accent="#0F9488" value={kpis.approved} format={formatIDR} delta={deltas.approved} subline={`${formatRatioPct(kpis.approvedPct)} of billing`} spark={monthly.map((m) => m.approved)} />
      </div>

      {/* Section 2 — Choropleth */}
      <motion.div variants={sectionVariants}>
        <SectionCard
          title="Claimants Distribution by Province"
          right={
            <span className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-white/90">Most by:</span>
              <span className="flex overflow-hidden rounded-md bg-white/15">
                {MAP_METRIC_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setMetric(o.key)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-semibold text-white/80 transition-colors hover:text-white",
                      metric === o.key && "bg-white text-[#1D4ED8] hover:text-[#1D4ED8]",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </span>
            </span>
          }
        >
          {isLoading ? (
            <Skeleton className="h-[420px] w-full" />
          ) : (
            <>
              {pinned && (
                <div className="mb-3">
                  <button
                    onClick={() => setPinned(null)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#1D4ED8] transition-colors hover:bg-[#DBEAFE]"
                  >
                    {pinned} <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <IndonesiaMap data={provinceMap} metric={metric} pinned={pinned} onPin={setPinned} />
            </>
          )}
        </SectionCard>
      </motion.div>

      {/* Section 3 — City table */}
      <motion.div variants={sectionVariants}>
        <SectionCard
          title={pinned ? `Detail Distribution by City — ${pinned}` : "Detail Distribution by City"}
          right={<SearchBox value={citySearch} onChange={setCitySearch} placeholder="Search city…" />}
        >
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <DataTable
              columns={cityColumns}
              rows={visibleCities}
              rowKey={(r) => r.city}
              maxHeight={420}
              footer={[
                "Total",
                formatNumber(kpis.transactions),
                formatNumber(kpis.claimants),
                formatIDR(kpis.billing),
                formatIDR(kpis.approved),
                formatRatioPct(kpis.approvedPct),
                formatIDR(kpis.avgApprovedPerClaimant),
              ]}
            />
          )}
        </SectionCard>
      </motion.div>

      {/* Section 4 — Monthly trend */}
      <motion.div variants={sectionVariants}>
        <SectionCard
          title="Monthly Trend Health Benefit Utilization"
          right={
            <span className="flex overflow-hidden rounded-md bg-white/15">
              {(["claimants", "transactions"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setLineMetric(k)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-semibold capitalize text-white/80 transition-colors hover:text-white",
                    lineMetric === k && "bg-white text-[#1D4ED8] hover:text-[#1D4ED8]",
                  )}
                >
                  {k}
                </button>
              ))}
            </span>
          }
        >
          {isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : (
            <>
              <div className="mb-2 flex items-center gap-4 text-[11.5px] font-semibold text-[#4B5563]">
                <span className="flex items-center gap-1.5"><span className="h-[3px] w-5 rounded" style={{ backgroundColor: CLAIMANT_BLUE }} /> {lineMetric === "claimants" ? "Claimants" : "Transactions"}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BILLING_RED }} /> Billing</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: APPROVED_YELLOW }} /> Approved</span>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={{ stroke: "#E5E8EC" }} />
                  <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} width={44} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => formatCompactIDR(v)} tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} width={56} />
                  <Tooltip
                    cursor={{ fill: "rgba(63,163,122,0.06)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const m = payload[0].payload as MonthRow;
                      return (
                        <div className="rounded-lg border border-[#E5E8EC] bg-white px-3 py-2 text-[12px] font-medium shadow-md tabular-nums">
                          <div className="mb-1 font-bold text-[#1F2A37]">{formatMonthShort(m.month)}</div>
                          <div>{lineMetric === "claimants" ? "Claimants" : "Transactions"}: {formatNumber(lineMetric === "claimants" ? m.claimants : m.transactions)}</div>
                          <div>Billing: IDR {formatIDR(m.billing)}</div>
                          <div>Approved: IDR {formatIDR(m.approved)} ({formatRatioPct(m.billing ? m.approved / m.billing : 0)})</div>
                        </div>
                      );
                    }}
                  />
                  <Bar yAxisId="right" dataKey="billing" name="Billing" fill={BILLING_RED} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600} />
                  <Bar yAxisId="right" dataKey="approved" name="Approved" fill={APPROVED_YELLOW} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600} animationBegin={80} />
                  <Line yAxisId="left" type="monotone" dataKey={lineMetric} stroke={CLAIMANT_BLUE} strokeWidth={2.5} dot={{ r: 3, fill: CLAIMANT_BLUE }} isAnimationActive animationDuration={900} />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
        </SectionCard>
      </motion.div>

      {/* Section 5 — Provider table */}
      <motion.div variants={sectionVariants}>
        <SectionCard
          title="Detail Distribution by Provider"
          right={<SearchBox value={providerSearch} onChange={setProviderSearch} placeholder="Search provider…" />}
        >
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <>
              <DataTable
                columns={providerColumns}
                rows={visibleProviders}
                rowKey={(r) => r.providerId}
                maxHeight={480}
                footer={[
                  "Total",
                  formatNumber(kpis.transactions),
                  formatNumber(kpis.claimants),
                  formatIDR(kpis.billing),
                  formatIDR(kpis.approved),
                  formatRatioPct(kpis.approvedPct),
                  formatIDR(kpis.avgApprovedPerClaimant),
                ]}
              />
              <button
                onClick={() => setShowAllProviders((s) => !s)}
                className="mt-3 text-[12.5px] font-semibold text-[#1D4ED8] hover:underline"
              >
                {showAllProviders ? "Show top 25 only" : `Show all ${formatNumber(providerRows.length)} providers`}
              </button>
            </>
          )}
        </SectionCard>
      </motion.div>

      {/* Section 6 — Export */}
      <motion.div variants={sectionVariants} className="flex items-center justify-end">
        <ExportButton
          filename={`adbrief-claims-map-${periode}.csv`}
          getPayload={() => ({
            headers: ["City", "Province", "Transaction", "Claimant", "Billing (IDR)", "Approved (IDR)", "%Approved", "Avg Approved/Claimant (IDR)"],
            rows: [
              ...visibleCities.map((r) => [r.city, r.province, r.transactions, r.claimants, r.billing, r.approved, formatRatioPct(r.billing ? r.approved / r.billing : 0), Math.round(avgApprovedCity(r))] as (string | number)[]),
              ["TOTAL", "", kpis.transactions, kpis.claimants, kpis.billing, kpis.approved, formatRatioPct(kpis.approvedPct), Math.round(kpis.avgApprovedPerClaimant)],
            ],
          })}
        />
      </motion.div>
    </motion.div>
  );
}

function PageTitle() {
  return (
    <div>
      <h1 className="font-display text-[28px] font-extrabold text-[#1F2A37] md:text-[32px]">Where Claimants Made Claims</h1>
      <p className="mt-1 text-sm italic text-[#9CA3AF]">
        Geographic distribution of claimants, transactions, and approved value across provinces, cities, and healthcare providers
      </p>
    </div>
  );
}