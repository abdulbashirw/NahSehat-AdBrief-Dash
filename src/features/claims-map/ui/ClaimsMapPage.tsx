/**
 * Indemnity — Claims Map (Where Claimants Made Claims)
 *
 * Content unchanged (map, city table, provider table, aggregations).
 * Layout & style follow OverviewPage:
 *   Header (live clock) → rolling KPI cards → Map + City table → Provider table.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  BadgeCheck,
  Building2,
  MapPin,
  Receipt,
  Search,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
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
import { formatDecimal, formatIDR, formatNumber, formatPct, formatRatioPct } from "@/shared/lib/format";

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

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

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/70" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 w-44 rounded-lg border border-white/20 bg-white/10 pl-8 pr-7 text-[11px] font-medium text-white outline-none placeholder:text-white/60 transition-all focus:border-white/50 focus:bg-white/20 sm:w-52"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export default function ClaimsMap() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { data, isLoading, isFetching, isError, refetch } = useIndemnityData();
  const exportEnabled = useExportEnabled();

  const filteredClaims = data?.claims;
  const members = data?.members;
  const providers = data?.providers;

  const kpis = useMemo(() => kpiSummary(filteredClaims ?? [], members ?? []), [filteredClaims, members]);
  const deltas = useMemo(() => kpiDeltas(filteredClaims ?? [], members ?? []), [filteredClaims, members]);
  const monthly = useMemo(() => byMonth(filteredClaims ?? []), [filteredClaims]);
  const cities = useMemo(() => byCity(filteredClaims ?? [], providers ?? []), [filteredClaims, providers]);
  const providerRows = useMemo(() => byProvider(filteredClaims ?? [], providers ?? []), [filteredClaims, providers]);
  const provinceMap = useMemo(() => byProvince(filteredClaims ?? [], providers ?? []), [filteredClaims, providers]);
  const locations = useMemo(() => providerLocations(filteredClaims ?? [], providers ?? []), [filteredClaims, providers]);

  const [metric, setMetric] = useState<MapMetric>("claimants");
  const [pinned, setPinned] = useState<string | null>(null);
  const [showLocations, setShowLocations] = useState(true);
  const [citySearch, setCitySearch] = useState("");
  const [providerSearch, setProviderSearch] = useState("");
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [liveClock, setLiveClock] = useState("");

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

  const cards = useMemo(
    () => [
      {
        id: "claimants",
        label: t("claimsMap.claimants"),
        value: formatNumber(kpis.claimants),
        icon: UserCheck,
        sublabel: t("claimsMap.claimantsSub"),
        iconBg: "bg-[#FFF7ED]",
        iconColor: "text-[#EA8C1F]",
        dotColor: "bg-[#EA8C1F]",
        topBorder: "border-t-[#EA8C1F]",
        accent: "#EA8C1F",
        delta: deltas.claimants,
      },
      {
        id: "transactions",
        label: t("claimsMap.transactions"),
        value: formatNumber(kpis.transactions),
        icon: Receipt,
        sublabel: t("claimsMap.transactionsSub"),
        iconBg: "bg-[#FFFBEB]",
        iconColor: "text-[#D9A400]",
        dotColor: "bg-[#D9A400]",
        topBorder: "border-t-[#D9A400]",
        accent: "#D9A400",
        delta: deltas.transactions,
      },
      {
        id: "healthcare",
        label: t("claimsMap.healthcare"),
        value: formatNumber(kpis.healthcare),
        icon: Building2,
        sublabel: t("claimsMap.healthcareSub"),
        iconBg: "bg-[#ECFDF5]",
        iconColor: "text-[#16A34A]",
        dotColor: "bg-[#16A34A]",
        topBorder: "border-t-[#16A34A]",
        accent: "#16A34A",
        delta: deltas.healthcare,
      },
      {
        id: "avgTxn",
        label: t("claimsMap.avgTxnPerClaimant"),
        value: formatDecimal(kpis.avgTxnPerClaimant),
        icon: Activity,
        sublabel: t("claimsMap.avgTxnSub"),
        iconBg: "bg-[#EFF6FF]",
        iconColor: "text-[#2563EB]",
        dotColor: "bg-[#2563EB]",
        topBorder: "border-t-[#2563EB]",
        accent: "#2563EB",
      },
      {
        id: "avgApproved",
        label: t("claimsMap.avgApprovedPerClaimant"),
        value: formatIDR(kpis.avgApprovedPerClaimant),
        icon: BadgeCheck,
        sublabel: t("claimsMap.avgApprovedSub"),
        iconBg: "bg-[#F5F3FF]",
        iconColor: "text-[#7C3AED]",
        dotColor: "bg-[#7C3AED]",
        topBorder: "border-t-[#7C3AED]",
        accent: "#7C3AED",
      },
      {
        id: "billing",
        label: t("claimsMap.billingIdr"),
        value: formatIDR(kpis.billing),
        icon: Wallet,
        sublabel: t("claimsMap.billingSub"),
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
        label: t("claimsMap.approvedIdr"),
        value: formatIDR(kpis.approved),
        icon: BadgeCheck,
        sublabel: `${formatRatioPct(kpis.approvedPct)} ${t("claimsMap.ofBilling")}`,
        iconBg: "bg-[#ECFDF5]",
        iconColor: "text-[#0F9488]",
        dotColor: "bg-[#0F9488]",
        topBorder: "border-t-[#0F9488]",
        accent: "#0F9488",
        delta: deltas.approved,
        spark: monthly.map((m) => m.approved),
      },
    ],
    [t, kpis, deltas, monthly],
  );

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

  const exportPayload = () => ({
    headers: [t("claimsMap.city"), t("claimsMap.province"), t("claimsMap.transaction"), t("claimsMap.claimant"), t("claimsMap.billingIdr"), t("claimsMap.approvedIdr"), t("claimsMap.pctApproved"), t("claimsMap.avgApprovedClaimantIdr")],
    rows: [
      ...visibleCities.map((r) => [r.city, r.province, r.transactions, r.claimants, r.billing, r.approved, formatRatioPct(r.billing ? r.approved / r.billing : 0), Math.round(avgApprovedCity(r))] as (string | number)[]),
      [t("common.total").toUpperCase(), "", kpis.transactions, kpis.claimants, kpis.billing, kpis.approved, formatRatioPct(kpis.approvedPct), Math.round(kpis.avgApprovedPerClaimant)],
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
          filename={`adbrief-claims-map-${periode}.csv`}
          getPayload={exportPayload}
        />
        <SectionCard title={t("claimsMap.title")} className="flex-1" bodyClassName="flex min-h-0 flex-col p-4">
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
        filename={`adbrief-claims-map-${periode}.csv`}
        getPayload={exportPayload}
      />

      <motion.div variants={sectionVariants} className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((card, index) => {
          const IconComp = card.icon;
          const delta = "delta" in card ? card.delta : undefined;
          const up = (delta ?? 0) >= 0;
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
                {delta !== undefined && (
                  <span className={cn("shrink-0 tabular-nums", up ? "text-[#16A34A]" : "text-[#DC2626]")}>
                    {up ? "↑" : "↓"} {formatPct(Math.abs(delta) * 100)}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-6">
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
                      {t(key === "claimants" ? "claimsMap.mapMetricTotalClaimant" : key === "transactions" ? "claimsMap.mapMetricTotalTransaction" : key === "approved" ? "claimsMap.mapMetricTotalApproved" : "claimsMap.mapMetricBilling")}
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

        <motion.div variants={sectionVariants} className="min-h-0 lg:col-span-3">
          <SectionCard
            title={pinned ? t("claimsMap.detailDistributionByCityPinned", { province: pinned }) : t("claimsMap.detailDistributionByCity")}
            right={<SearchBox value={citySearch} onChange={setCitySearch} placeholder={t("claimsMap.searchCity")} />}
            className="h-full"
            bodyClassName="flex min-h-0 flex-col p-4"
          >
            {isLoading ? (
              <Skeleton className="min-h-0 w-full flex-1" />
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

      <motion.div variants={sectionVariants} className="min-h-0 flex-1">
        <SectionCard
          title={t("claimsMap.detailDistributionByProvider")}
          right={<SearchBox value={providerSearch} onChange={setProviderSearch} placeholder={t("claimsMap.searchProvider")} />}
          className="h-full"
          bodyClassName="flex min-h-0 flex-col p-4"
        >
          {isLoading ? (
            <Skeleton className="min-h-0 w-full flex-1" />
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
        <h1 className="font-display text-[24px] font-extrabold text-[#1F2A37] md:text-[28px]">{t("claimsMap.whereClaimantsMadeClaims")}</h1>
        <p className="mt-0.5 text-[13px] italic text-[#9CA3AF]">{t("claimsMap.subtitle")}</p>
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
