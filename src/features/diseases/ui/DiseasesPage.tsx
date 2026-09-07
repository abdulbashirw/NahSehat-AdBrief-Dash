/**
 * Indemnity — Diseases (Most Frequent Diseases)
 *
 * One-page layout: header + KPI row fixed at top, disease bars and diagnosis
 * table side-by-side filling the remaining viewport height with internal scroll.
 *
 * Migrated from the original Diseases page to use RTK Query data.
 * All business logic (aggregation, KPIs, charts, tables) preserved.
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
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
import { byDiagnosis, byMonth, kpiDeltas, kpiSummary } from "@/entities/claim/lib/aggregate";
import type { DiagnosisRow } from "@/entities/claim/lib/aggregate";
import { byDiseaseGroup } from "@/features/indemnity-overview/utils/diseaseAgg";
import { formatCompactIDR, formatDecimal, formatIDR, formatNumber, formatRatioPct } from "@/shared/lib/format";
import { useTranslation } from "react-i18next";

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

const DISEASE_CYAN = "#06B6D4";
const BUBBLE_BLUE = "#2563EB";

export default function Diseases() {
  const { t } = useTranslation();
  const { data, isLoading, isFetching, lastUpdated, isError, refetch } = useIndemnityData();
  const exportEnabled = useExportEnabled();

  const filteredClaims = data?.claims ?? [];
  const members = data?.members ?? [];
  const icd10 = data?.icd10 ?? [];

  const kpis = useMemo(() => kpiSummary(filteredClaims, members), [filteredClaims, members]);
  const deltas = useMemo(() => kpiDeltas(filteredClaims, members), [filteredClaims, members]);
  const monthly = useMemo(() => byMonth(filteredClaims), [filteredClaims]);
  const groups = useMemo(() => byDiseaseGroup(filteredClaims, icd10).slice(0, 10), [filteredClaims, icd10]);
  const diagnoses = useMemo(() => byDiagnosis(filteredClaims, icd10), [filteredClaims, icd10]);

  const [diagSearch, setDiagSearch] = useState("");
  const [showAllDiag, setShowAllDiag] = useState(false);

  const visibleDiagnoses = useMemo(() => {
    let rows = diagnoses;
    const q = diagSearch.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    return showAllDiag ? rows : rows.slice(0, 15);
  }, [diagnoses, diagSearch, showAllDiag]);

  const groupMax = Math.max(1, ...groups.map((g) => g.claimants));
  const bubbleMax = Math.max(1, ...groups.map((g) => g.approved));

  const diagColumns: DataColumn<DiagnosisRow>[] = useMemo(
    () => [
      {
        key: "code",
        label: t("diseases.icd10"),
        value: (r) => r.code,
        render: (r) => (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#1F2A37]">{r.code}</span>
        ),
      },
      { key: "description", label: t("diseases.description"), value: (r) => r.description },
      { key: "approved", label: t("diseases.totalApprovedIdr"), align: "right", value: (r) => r.approved, render: (r) => formatIDR(r.approved) },
      { key: "transaction", label: t("diseases.totalTransaction"), align: "right", value: (r) => r.transactions, render: (r) => formatNumber(r.transactions) },
      {
        key: "avgTxn",
        label: t("diseases.avgTxnPerClaimant"),
        align: "right",
        value: (r) => (r.claimants ? r.transactions / r.claimants : 0),
        render: (r) => formatDecimal(r.claimants ? r.transactions / r.claimants : 0),
      },
      {
        key: "avgApproved",
        label: t("diseases.avgApprovedPerClaimant"),
        align: "right",
        value: (r) => (r.claimants ? r.approved / r.claimants : 0),
        render: (r) => formatIDR(r.claimants ? r.approved / r.claimants : 0),
      },
      { key: "los", label: t("diseases.avgLos"), align: "right", value: (r) => r.avgLos, render: (r) => formatDecimal(r.avgLos) },
    ],
    [],
  );

  if (isError) return <ApiError onRetry={refetch} />;

  if (!isLoading && filteredClaims.length === 0) {
    return (
      <div className="flex h-full flex-col gap-3">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <PageTitle />
          <div className="flex flex-wrap items-center justify-end gap-3">
            <PeriodFilter isFetching={isFetching} lastUpdated={lastUpdated} />
            {exportEnabled && (
              <div className="flex items-center gap-3">
                <div className="w-px self-stretch bg-[#E5E8EC]" />
                <ExportButton
                  filename="adbrief-diseases.csv"
                  getPayload={() => ({
                    headers: [t("diseases.icd10"), t("diseases.description"), t("diseases.group"), t("diseases.totalApprovedIdrExport"), t("diseases.totalTransactionExport"), t("diseases.avgTransactionPerClaimant"), t("diseases.avgApprovedPerClaimantExport"), t("diseases.avgLosDays")],
                    rows: diagnoses.map((r) => [
                      r.code,
                      r.description,
                      r.group,
                      r.approved,
                      r.transactions,
                      r.claimants ? +(r.transactions / r.claimants).toFixed(2) : 0,
                      r.claimants ? Math.round(r.approved / r.claimants) : 0,
                      +r.avgLos.toFixed(2),
                    ] as (string | number)[]),
                  })}
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <SectionCard title={t("diseases.mostFrequentDiseases")} className="h-full">
            <EmptyState />
          </SectionCard>
        </div>
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
                filename="adbrief-diseases.csv"
                getPayload={() => ({
                  headers: [t("diseases.icd10"), t("diseases.description"), t("diseases.group"), t("diseases.totalApprovedIdrExport"), t("diseases.totalTransactionExport"), t("diseases.avgTransactionPerClaimant"), t("diseases.avgApprovedPerClaimantExport"), t("diseases.avgLosDays")],
                  rows: diagnoses.map((r) => [
                    r.code,
                    r.description,
                    r.group,
                    r.approved,
                    r.transactions,
                    r.claimants ? +(r.transactions / r.claimants).toFixed(2) : 0,
                    r.claimants ? Math.round(r.approved / r.claimants) : 0,
                    +r.avgLos.toFixed(2),
                  ] as (string | number)[]),
                })}
              />
            </>
          )}
        </div>
      </div>

        {/* Section 1 — KPI row */}
        <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard index={0} loading={isLoading} label={t("diseases.claimants")} accent="#EA8C1F" value={kpis.claimants} format={formatNumber} delta={deltas.claimants} />
          <KpiCard index={1} loading={isLoading} label={t("diseases.transactions")} accent="#D9A400" value={kpis.transactions} format={formatNumber} delta={deltas.transactions} />
          <KpiCard index={2} loading={isLoading} label={t("diseases.healthcare")} accent="#14B8A6" value={kpis.healthcare} format={formatNumber} delta={deltas.healthcare} />
          <KpiCard index={3} loading={isLoading} label={t("diseases.avgTxnPerClaimant")} accent="#2563EB" value={kpis.avgTxnPerClaimant} format={formatDecimal} />
          <KpiCard index={4} loading={isLoading} label={t("diseases.avgApprovedPerClaimant")} accent="#7C3AED" value={kpis.avgApprovedPerClaimant} format={formatIDR} />
          <KpiCard index={5} loading={isLoading} label={t("diseases.billing")} accent="#9B2226" value={kpis.billing} format={formatIDR} delta={deltas.billing} spark={monthly.map((m) => m.billing)} />
          <KpiCard index={6} loading={isLoading} label={t("diseases.approved")} accent="#0F9488" value={kpis.approved} format={formatIDR} delta={deltas.approved} subline={`${formatRatioPct(kpis.approvedPct)} ${t("diseases.ofBilling")}`} spark={monthly.map((m) => m.approved)} />
        </div>

        {/* ── Row 2 & 3 — stacked full-width, fill remaining viewport height ── */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Row 2 — Most Frequent Diseases (bar + bubble) */}
          <motion.div variants={sectionVariants} className="min-h-0 flex-1">
            <SectionCard
              title={t("diseases.mostFrequentDiseases")}
              className="h-full"
              bodyClassName="flex min-h-0 flex-col p-4"
              right={
                <span className="hidden items-center gap-3 text-[10px] font-semibold text-white/90 sm:flex">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: DISEASE_CYAN }} />
                    {t("diseases.claimants")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BUBBLE_BLUE }} />
                    {t("diseases.approved")}
                  </span>
                </span>
              }
            >
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                  {groups.map((g, i) => {
                    const bubbleSize = 44 + Math.sqrt(g.approved / bubbleMax) * 34;
                    return (
                      <div key={g.group} className="group grid grid-cols-[24px_minmax(180px,300px)_1fr] items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F1F3F5] text-[11px] font-bold text-[#4B5563] tabular-nums">
                          {i + 1}
                        </span>
                        <div className="truncate pr-2 text-right text-[12.5px] font-semibold text-[#1F2A37]" title={g.group}>
                          {g.group}
                        </div>
                        <div className="relative flex h-9 items-center">
                          {/* Track */}
                          <div className="absolute inset-y-0 left-0 w-[82%] rounded-r-md bg-[#F1F3F5]" />
                          {/* Bar */}
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: i * 0.06, duration: 0.7, ease: "easeOut" }}
                            className="relative h-full origin-left rounded-r-md transition-[filter] duration-150 group-hover:brightness-105"
                            style={{ width: `${Math.max(2, (g.claimants / groupMax) * 82)}%`, backgroundColor: DISEASE_CYAN }}
                            title={`${g.group} · ${formatNumber(g.claimants)} ${t("diseases.claimantsBar")} · ${formatNumber(g.transactions)} ${t("diseases.transactionsBar")} · ${t("diseases.approvedBar")} ${formatIDR(g.approved)} · ${t("diseases.avgLosBar")} ${formatDecimal(g.avgLos)} ${t("diseases.daysBar")}`}
                          >
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold tabular-nums text-white">
                              {formatNumber(g.claimants)}
                            </span>
                          </motion.div>
                          {/* Bubble */}
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.5 + i * 0.06, type: "spring", stiffness: 300, damping: 18 }}
                            className="ml-2 flex shrink-0 items-center justify-center rounded-full text-center text-white shadow-md ring-2 ring-white/30 transition-transform duration-150 group-hover:scale-105"
                            style={{ width: bubbleSize, height: bubbleSize, backgroundColor: BUBBLE_BLUE }}
                          >
                            <span className="px-1 text-[10px] font-bold leading-tight tabular-nums">IDR {formatCompactIDR(g.approved)}</span>
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </motion.div>

          {/* Row 3 — Diagnosis Detail (DataTable) */}
          <motion.div variants={sectionVariants} className="min-h-0 flex-[1.5]">
            <SectionCard
              title={t("diseases.diagnosisDetail")}
              className="h-full"
              bodyClassName="flex min-h-0 flex-col p-4"
              right={
                <div className="flex items-center gap-2.5">
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                    {visibleDiagnoses.length}/{diagnoses.length}
                  </span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/70" />
                    <input
                      value={diagSearch}
                      onChange={(e) => setDiagSearch(e.target.value)}
                      placeholder={t("diseases.searchIcd")}
                      className="h-8 w-48 rounded-md border border-white/30 bg-white/10 pl-8 pr-3 text-[12px] font-medium text-white outline-none placeholder:text-white/60 focus:border-white/50 focus:bg-white/20"
                    />
                  </div>
                </div>
              }
            >
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : visibleDiagnoses.length === 0 ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
                  <Search className="h-8 w-8 text-[#9CA3AF]" />
                  <p className="text-[13px] font-medium text-[#4B5563]">{t("diseases.noResults")}</p>
                  <button onClick={() => setDiagSearch("")} className="text-[12px] font-semibold text-[#1D4ED8] hover:underline">
                    {t("diseases.clearSearch")}
                  </button>
                </div>
              ) : (
                <>
                  <DataTable
                    className="min-h-0 flex-1"
                    columns={diagColumns}
                    rows={visibleDiagnoses}
                    rowKey={(r) => r.code}
                    footer={[
                      t("diseases.totalLabel"),
                      "",
                      formatIDR(kpis.approved),
                      formatNumber(kpis.transactions),
                      formatDecimal(kpis.avgTxnPerClaimant),
                      formatIDR(kpis.avgApprovedPerClaimant),
                      formatDecimal(
                        diagnoses.length ? diagnoses.reduce((s, d) => s + d.avgLos * d.transactions, 0) / (kpis.transactions || 1) : 0,
                      ),
                    ]}
                  />
                  {diagnoses.length > 15 && (
                    <button
                      onClick={() => setShowAllDiag((s) => !s)}
                      className="mt-3 flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#E5E8EC] bg-white px-3 py-2 text-[12px] font-semibold text-[#1D4ED8] transition-colors hover:border-[#1D4ED8]/30 hover:bg-[#F8FAFB]"
                    >
                      {showAllDiag ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          {t("diseases.showTopOnly")}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          {t("diseases.showAllDiagnoses", { count: diagnoses.length })}
                        </>
                      )}
                    </button>
                  )}
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
      <h1 className="font-display text-[24px] font-extrabold text-[#1F2A37] md:text-[28px]">{t("diseases.title")}</h1>
      <p className="mt-0.5 text-[13px] italic text-[#9CA3AF]">
        {t("diseases.subtitle")}
      </p>
    </div>
  );
}