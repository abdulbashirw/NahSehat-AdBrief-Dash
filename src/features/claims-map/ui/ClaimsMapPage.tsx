/**
 * Indemnity — Claims Map (Where Claimants Made Claims)
 *
 * Migrated from the original ClaimsMap page to use RTK Query data.
 * All business logic (aggregation, KPIs, map, tables) preserved.
 *
 * Layout — One-page responsive concept (matches OverviewPage):
 *   Header → KPI row → Map + City table (side-by-side on lg+) → Provider table (full width).
 * Monthly trend chart removed; monthly data retained for KPI sparklines only.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { MapPin, Search, X } from "lucide-react";
import KpiCard from "@/shared/components/common/KpiCard";
import SectionCard from "@/shared/components/common/SectionCard";
import DataTable from "@/shared/components/common/DataTable";
import type { DataColumn } from "@/shared/components/common/DataTable";
import ExportButton from "@/shared/components/common/ExportButton";
import { useExportEnabled } from "@/entities/settings/model/useSettings";
import EmptyState from "@/shared/components/common/EmptyState";
import ApiError from "@/shared/components/error/ApiError";
import IndonesiaMap, { MAP_METRIC_KEYS } from "@/features/claims-map/components/IndonesiaMap";
import type { MapMetric } from "@/features/claims-map/components/IndonesiaMap";
import { Skeleton } from "@/shared/ui/skeleton";
import { useIndemnityData } from "@/features/indemnity-overview/hooks/useIndemnityData";
import PeriodFilter from "@/features/indemnity-overview/components/PeriodFilter";
import { byCity, byMonth, byProvider, byProvince, kpiDeltas, kpiSummary, providerLocations } from "@/entities/claim/lib/aggregate";
import type { CityRow, ProviderRow } from "@/entities/claim/lib/aggregate";
import { cn } from "@/shared/lib/utils";
import { formatDecimal, formatIDR, formatNumber, formatRatioPct } from "@/shared/lib/format";

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#9CA3AF]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 w-52 rounded-md border border-[#E5E8EC] pl-7 pr-3 text-[11.5px] font-medium text-[#1F2A37] outline-none placeholder:text-[#9CA3AF] focus:border-[#3FA37A] focus:ring-2 focus:ring-[#3FA37A]/20"
      />
    </div>
  );
}

export default function ClaimsMap() {
  const { t } = useTranslation();
  const { data, isLoading, isFetching, lastUpdated, isError, refetch } = useIndemnityData();
  const exportEnabled = useExportEnabled();

  const filteredClaims = data?.claims ?? [];
  const members = data?.members ?? [];
  const providers = data?.providers ?? [];

  const kpis = useMemo(() => kpiSummary(filteredClaims, members), [filteredClaims, members]);
  const deltas = useMemo(() => kpiDeltas(filteredClaims, members), [filteredClaims, members]);
  const monthly = useMemo(() => byMonth(filteredClaims), [filteredClaims]);
  const cities = useMemo(() => byCity(filteredClaims, providers), [filteredClaims, providers]);
  const providerRows = useMemo(() => byProvider(filteredClaims, providers), [filteredClaims, providers]);
  const provinceMap = useMemo(() => byProvince(filteredClaims, providers), [filteredClaims, providers]);
  const locations = useMemo(() => providerLocations(filteredClaims, providers), [filteredClaims, providers]);

  const [metric, setMetric] = useState<MapMetric>("claimants");
  const [pinned, setPinned] = useState<string | null>(null);
  const [showLocations, setShowLocations] = useState(true);
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
      { key: "city", label: t("claimsMap.city"), value: (r) => r.city, render: (r) => <span className="font-semibold">{r.city}</span> },
      { key: "transaction", label: t("claimsMap.transaction"), align: "right", value: (r) => r.transactions, render: (r) => formatNumber(r.transactions) },
      { key: "claimant", label: t("claimsMap.claimant"), align: "right", value: (r) => r.claimants, render: (r) => formatNumber(r.claimants) },
      { key: "billing", label: t("claimsMap.billing"), align: "right", value: (r) => r.billing, render: (r) => formatIDR(r.billing) },
      { key: "approved", label: t("claimsMap.approvedCol"), align: "right", value: (r) => r.approved, render: (r) => formatIDR(r.approved) },
      {
        key: "pct",
        label: t("claimsMap.pctApproved"),
        align: "right",
        value: (r) => (r.billing ? r.approved / r.billing : 0),
        render: (r) => formatRatioPct(r.billing ? r.approved / r.billing : 0),
        progressOf: (r) => (r.billing ? r.approved / r.billing : 0),
      },
      { key: "avg", label: t("claimsMap.avgApprovedPerClaimant"), align: "right", value: avgApprovedCity, render: (r) => formatIDR(avgApprovedCity(r)) },
    ],
    [t],
  );

  const providerColumns: DataColumn<ProviderRow>[] = useMemo(
    () => [
      {
        key: "provider",
        label: t("claimsMap.providerName"),
        value: (r) => r.providerName,
        render: (r) => (
          <span className="flex items-center gap-2">
            <span className="font-semibold">{r.providerName}</span>
            {!r.inNetwork && <span className="rounded bg-[#F2C230]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#8a6d00]">{t("claimsMap.nonProvider")}</span>}
          </span>
        ),
      },
      { key: "transaction", label: t("claimsMap.transaction"), align: "right", value: (r) => r.transactions, render: (r) => formatNumber(r.transactions) },
      { key: "claimant", label: t("claimsMap.claimant"), align: "right", value: (r) => r.claimants, render: (r) => formatNumber(r.claimants) },
      { key: "billing", label: t("claimsMap.billing"), align: "right", value: (r) => r.billing, render: (r) => formatIDR(r.billing) },
      { key: "approved", label: t("claimsMap.approvedCol"), align: "right", value: (r) => r.approved, render: (r) => formatIDR(r.approved) },
      {
        key: "pct",
        label: t("claimsMap.pctApproved"),
        align: "right",
        value: (r) => r.approvedPct,
        render: (r) => formatRatioPct(r.approvedPct),
        progressOf: (r) => r.approvedPct,
      },
      {
        key: "avg",
        label: t("claimsMap.avgApprovedPerClaimant"),
        align: "right",
        value: (r) => (r.claimants ? r.approved / r.claimants : 0),
        render: (r) => formatIDR(r.claimants ? r.approved / r.claimants : 0),
      },
    ],
    [t],
  );

  const periode = "claims-map";

  if (isError) return <ApiError onRetry={refetch} />;

  if (!isLoading && filteredClaims.length === 0) {
    return (
      <div className="flex h-full flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <PageTitle />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <PeriodFilter isFetching={isFetching} lastUpdated={lastUpdated} />
            {exportEnabled && (
              <div className="flex items-center gap-3">
                <div className="w-px self-stretch bg-[#E5E8EC]" />
                <ExportButton
                  filename={`adbrief-claims-map-${periode}.csv`}
                  getPayload={() => ({
                    headers: [t("claimsMap.city"), t("claimsMap.province"), t("claimsMap.transaction"), t("claimsMap.claimant"), t("claimsMap.billingIdr"), t("claimsMap.approvedIdr"), t("claimsMap.pctApproved"), t("claimsMap.avgApprovedClaimantIdr")],
                    rows: [
                      ...visibleCities.map((r) => [r.city, r.province, r.transactions, r.claimants, r.billing, r.approved, formatRatioPct(r.billing ? r.approved / r.billing : 0), Math.round(avgApprovedCity(r))] as (string | number)[]),
                      [t("common.total").toUpperCase(), "", kpis.transactions, kpis.claimants, kpis.billing, kpis.approved, formatRatioPct(kpis.approvedPct), Math.round(kpis.avgApprovedPerClaimant)],
                    ],
                  })}
                />
              </div>
            )}
          </div>
        </div>
        <SectionCard title={t("claimsMap.title")} className="flex-1" bodyClassName="flex min-h-0 flex-col p-4">
          <EmptyState />
        </SectionCard>
      </div>
    );
  }

  return (
    <motion.div className="flex h-full flex-col gap-3 transition-opacity duration-300" style={{ opacity: isFetching && !isLoading ? 0.55 : 1 }} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
      {/* ── Header: title + filters + export ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <PageTitle />
        <div className="flex items-center justify-end gap-2">
          <PeriodFilter isFetching={isFetching} lastUpdated={lastUpdated} />
          {exportEnabled && (
            <>
              <div className="w-px self-stretch bg-[#E5E8EC]" />
              <ExportButton
                filename={`adbrief-claims-map-${periode}.csv`}
                getPayload={() => ({
                  headers: [t("claimsMap.city"), t("claimsMap.province"), t("claimsMap.transaction"), t("claimsMap.claimant"), t("claimsMap.billingIdr"), t("claimsMap.approvedIdr"), t("claimsMap.pctApproved"), t("claimsMap.avgApprovedClaimantIdr")],
                  rows: [
                    ...visibleCities.map((r) => [r.city, r.province, r.transactions, r.claimants, r.billing, r.approved, formatRatioPct(r.billing ? r.approved / r.billing : 0), Math.round(avgApprovedCity(r))] as (string | number)[]),
                    [t("common.total").toUpperCase(), "", kpis.transactions, kpis.claimants, kpis.billing, kpis.approved, formatRatioPct(kpis.approvedPct), Math.round(kpis.avgApprovedPerClaimant)],
                  ],
                })}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Section 1 — KPI row ── */}
        <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard index={0} loading={isLoading} label={t("claimsMap.claimants")} accent="#EA8C1F" value={kpis.claimants} format={formatNumber} delta={deltas.claimants} />
          <KpiCard index={1} loading={isLoading} label={t("claimsMap.transactions")} accent="#D9A400" value={kpis.transactions} format={formatNumber} delta={deltas.transactions} />
          <KpiCard index={2} loading={isLoading} label={t("claimsMap.healthcare")} accent="#16A34A" value={kpis.healthcare} format={formatNumber} delta={deltas.healthcare} />
          <KpiCard index={3} loading={isLoading} label={t("claimsMap.avgTxnPerClaimant")} accent="#2563EB" value={kpis.avgTxnPerClaimant} format={formatDecimal} />
          <KpiCard index={4} loading={isLoading} label={t("claimsMap.avgApprovedPerClaimant")} accent="#7C3AED" value={kpis.avgApprovedPerClaimant} format={formatIDR} />
          <KpiCard index={5} loading={isLoading} label={t("claimsMap.billingIdr")} accent="#9B2226" value={kpis.billing} format={formatIDR} delta={deltas.billing} spark={monthly.map((m) => m.billing)} />
          <KpiCard index={6} loading={isLoading} label={t("claimsMap.approvedIdr")} accent="#0F9488" value={kpis.approved} format={formatIDR} delta={deltas.approved} subline={`${formatRatioPct(kpis.approvedPct)} ${t("claimsMap.ofBilling")}`} spark={monthly.map((m) => m.approved)} />
        </div>

        {/* ── Section 2 — Map + City table (side-by-side on lg+) ── */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-6">
          {/* 2a: Claimants Distribution (Map) */}
          <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-3">
            <SectionCard
              title={t("claimsMap.claimantsDistribution")}
              className="h-full"
              bodyClassName="flex min-h-0 flex-col p-3"
              right={
                <span className="flex items-center gap-2">
                  <span className="hidden text-[11px] font-semibold text-white/90 sm:inline">{t("claimsMap.mostBy")}:</span>
                  <span className="flex overflow-hidden rounded-md bg-white/15">
                    {MAP_METRIC_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => setMetric(key)}
                        className={cn(
                          "px-2.5 py-1 text-[11px] font-semibold text-white/80 transition-colors hover:text-white",
                          metric === key && "bg-white text-[#1D4ED8] hover:text-[#1D4ED8]",
                        )}
                      >
                        {t(key === 'claimants' ? 'claimsMap.mapMetricTotalClaimant' : key === 'transactions' ? 'claimsMap.mapMetricTotalTransaction' : key === 'approved' ? 'claimsMap.mapMetricTotalApproved' : 'claimsMap.mapMetricBilling')}
                      </button>
                    ))}
                  </span>
                  <button
                    onClick={() => locations.length > 0 && setShowLocations((v) => !v)}
                    disabled={locations.length === 0}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      locations.length === 0
                        ? "cursor-not-allowed bg-white/5 text-white/30"
                        : showLocations
                          ? "bg-white/25 text-white"
                          : "bg-white/10 text-white/60 hover:text-white/90",
                    )}
                    title={
                      locations.length === 0
                        ? t("claimsMap.noProviderCoordinates")
                        : showLocations
                          ? t("claimsMap.hideProviderLocations")
                          : t("claimsMap.showProviderLocations")
                    }
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {locations.length === 0 ? t("claimsMap.locationsOff") : showLocations ? t("claimsMap.locationsOn") : t("claimsMap.locationsOff")}
                  </button>
                </span>
              }
            >
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  {pinned && (
                    <div className="mb-3 shrink-0">
                      <button
                        onClick={() => setPinned(null)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#1D4ED8] transition-colors hover:bg-[#DBEAFE]"
                      >
                        {pinned} <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <IndonesiaMap
                    data={provinceMap}
                    metric={metric}
                    pinned={pinned}
                    onPin={setPinned}
                    locations={locations}
                    showLocations={showLocations && locations.length > 0}
                  />
                </div>
              )}
            </SectionCard>
          </motion.div>

          {/* 2b: City table */}
          <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-3">
            <SectionCard
              title={pinned ? `${t("claimsMap.detailDistributionByCityPinned")} — ${pinned}` : t("claimsMap.detailDistributionByCity")}
              right={<SearchBox value={citySearch} onChange={setCitySearch} placeholder={t("claimsMap.searchCity")} />}
              className="h-full"
              bodyClassName="flex min-h-0 flex-col p-4"
            >
              {isLoading ? (
                <Skeleton className="min-h-0 flex-1 w-full" />
              ) : (
                <DataTable
                  columns={cityColumns}
                  rows={visibleCities}
                  rowKey={(r) => r.city}
                  className="min-h-0 flex-1"
                  footer={[
                    t("common.total"),
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
        </div>

        {/* ── Section 3 — Provider table (full width, flex-fill) ── */}
        <motion.div variants={sectionVariants} className="min-h-0 flex-1">
          <SectionCard
            title={t("claimsMap.detailDistributionByProvider")}
            right={<SearchBox value={providerSearch} onChange={setProviderSearch} placeholder={t("claimsMap.searchProvider")} />}
            className="h-full"
            bodyClassName="flex min-h-0 flex-col p-4"
          >
            {isLoading ? (
              <Skeleton className="min-h-0 flex-1 w-full" />
            ) : (
              <>
                <DataTable
                  columns={providerColumns}
                  rows={visibleProviders}
                  rowKey={(r) => r.providerId}
                  className="min-h-0 flex-1"
                  footer={[
                    t("common.total"),
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
                  className="mt-2 shrink-0 text-[11.5px] font-semibold text-[#1D4ED8] hover:underline"
                >
                  {showAllProviders ? t("claimsMap.showTop25Only") : t("claimsMap.showAllProviders", { count: formatNumber(providerRows.length) })}
                </button>
              </>
            )}
          </SectionCard>
        </motion.div>
    </motion.div>
  );
}

function PageTitle() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="font-display text-[20px] font-extrabold text-[#1F2A37] md:text-[24px]">{t("claimsMap.whereClaimantsMadeClaims")}</h1>
      <p className="mt-0.5 max-w-[560px] line-clamp-1 text-[12px] italic text-[#9CA3AF]">
        {t("claimsMap.subtitle")}
      </p>
    </div>
  );
}