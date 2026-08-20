/**
 * Indemnity — Diseases (Most Frequent Diseases)
 *
 * Migrated from the original Diseases page to use RTK Query data.
 * All business logic (aggregation, KPIs, charts, tables) preserved.
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, User } from "lucide-react";
import KpiCard from "@/shared/components/common/KpiCard";
import SectionCard from "@/shared/components/common/SectionCard";
import DataTable from "@/shared/components/common/DataTable";
import type { DataColumn } from "@/shared/components/common/DataTable";
import ExportButton from "@/shared/components/common/ExportButton";
import EmptyState from "@/shared/components/common/EmptyState";
import ApiError from "@/shared/components/error/ApiError";
import { Skeleton } from "@/shared/ui/skeleton";
import { useIndemnityData } from "@/features/indemnity-overview/hooks/useIndemnityData";
import PeriodFilter from "@/features/indemnity-overview/components/PeriodFilter";
import { AGE_BUCKETS, byAgeGender, byDiagnosis, byMonth, byRelationship, kpiDeltas, kpiSummary } from "@/entities/claim/lib/aggregate";
import type { DiagnosisRow, RelationshipRow } from "@/entities/claim/lib/aggregate";
import { byDiseaseGroup } from "@/features/indemnity-overview/utils/diseaseAgg";
import { formatCompactIDR, formatIDR, formatNumber, formatRatioPct } from "@/shared/lib/format";

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

const REL_COLORS: Record<string, string> = { PRINCIPLE: "#1D4ED8", CHILD: "#3B82F6", SPOUSE: "#93C5FD" };
const F_PINK = "#EC6FA0";
const M_BLUE = "#3B82F6";
const DISEASE_CYAN = "#06B6D4";
const BUBBLE_BLUE = "#2563EB";

const formatDecimal = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function Diseases() {
  const { data, isLoading, isFetching, lastUpdated, isError, refetch } = useIndemnityData();

  const filteredClaims = data?.claims ?? [];
  const members = data?.members ?? [];
  const icd10 = data?.icd10 ?? [];

  const kpis = useMemo(() => kpiSummary(filteredClaims, members), [filteredClaims, members]);
  const deltas = useMemo(() => kpiDeltas(filteredClaims, members), [filteredClaims, members]);
  const monthly = useMemo(() => byMonth(filteredClaims), [filteredClaims]);
  const relationships = useMemo(() => byRelationship(members, filteredClaims), [members, filteredClaims]);
  const groups = useMemo(() => byDiseaseGroup(filteredClaims, icd10).slice(0, 10), [filteredClaims, icd10]);
  const ageGender = useMemo(() => byAgeGender(members, filteredClaims), [members, filteredClaims]);
  const diagnoses = useMemo(() => byDiagnosis(filteredClaims, icd10), [filteredClaims, icd10]);

  const [diagSearch, setDiagSearch] = useState("");
  const [showAllDiag, setShowAllDiag] = useState(false);

  const visibleDiagnoses = useMemo(() => {
    let rows = diagnoses;
    const q = diagSearch.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.code.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    return showAllDiag ? rows : rows.slice(0, 15);
  }, [diagnoses, diagSearch, showAllDiag]);

  const relTotal = relationships.reduce((s, r) => s + r.claimants, 0) || 1;
  const relMax = Math.max(1, ...relationships.map((r) => r.claimants));
  const groupMax = Math.max(1, ...groups.map((g) => g.claimants));
  const bubbleMax = Math.max(1, ...groups.map((g) => g.approved));
  const ageMax = Math.max(1, ...ageGender.flatMap((r) => [r.female, r.male]));
  const totalFemale = ageGender.reduce((s, r) => s + r.female, 0);
  const totalMale = ageGender.reduce((s, r) => s + r.male, 0);

  const diagColumns: DataColumn<DiagnosisRow>[] = useMemo(
    () => [
      {
        key: "code",
        label: "ICD-10",
        value: (r) => r.code,
        render: (r) => (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#1F2A37]">{r.code}</span>
        ),
      },
      { key: "description", label: "Description", value: (r) => r.description },
      { key: "approved", label: "Total Approved (IDR)", align: "right", value: (r) => r.approved, render: (r) => formatIDR(r.approved) },
      { key: "transaction", label: "Total Transaction", align: "right", value: (r) => r.transactions, render: (r) => formatNumber(r.transactions) },
      {
        key: "avgTxn",
        label: "Avg. Transaksi / Claimant",
        align: "right",
        value: (r) => (r.claimants ? r.transactions / r.claimants : 0),
        render: (r) => formatDecimal(r.claimants ? r.transactions / r.claimants : 0),
      },
      {
        key: "avgApproved",
        label: "Avg. Approved / Claimant (IDR)",
        align: "right",
        value: (r) => (r.claimants ? r.approved / r.claimants : 0),
        render: (r) => formatIDR(r.claimants ? r.approved / r.claimants : 0),
      },
      { key: "los", label: "Avg. LOS (days)", align: "right", value: (r) => r.avgLos, render: (r) => formatDecimal(r.avgLos) },
    ],
    [],
  );

  if (isError) return <ApiError onRetry={refetch} />;

  if (!isLoading && filteredClaims.length === 0) {
    return (
      <div className="space-y-6">
        <PageTitle />
        <PeriodFilter isFetching={isFetching} lastUpdated={lastUpdated} />
        <SectionCard title="The Most Frequent Diseases">
          <EmptyState />
        </SectionCard>
      </div>
    );
  }

  return (
    <motion.div className="space-y-6" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
      <PageTitle />
      <PeriodFilter isFetching={isFetching} lastUpdated={lastUpdated} />

      {/* Content area — subtle dim during background refetch (not initial load) */}
      <div className="space-y-6 transition-opacity duration-300" style={{ opacity: isFetching && !isLoading ? 0.55 : 1 }}>
      {/* Section 1 — KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard index={0} loading={isLoading} label="Claimants" accent="#EA8C1F" value={kpis.claimants} format={formatNumber} delta={deltas.claimants} />
        <KpiCard index={1} loading={isLoading} label="Transactions" accent="#D9A400" value={kpis.transactions} format={formatNumber} delta={deltas.transactions} />
        <KpiCard index={2} loading={isLoading} label="Healthcare" accent="#14B8A6" value={kpis.healthcare} format={formatNumber} delta={deltas.healthcare} />
        <KpiCard index={3} loading={isLoading} label="Avg. Transactions / Claimant" accent="#2563EB" value={kpis.avgTxnPerClaimant} format={formatDecimal} />
        <KpiCard index={4} loading={isLoading} label="Avg. Approved / Claimant (IDR)" accent="#7C3AED" value={kpis.avgApprovedPerClaimant} format={formatIDR} />
        <KpiCard index={5} loading={isLoading} label="Billing (IDR)" accent="#9B2226" value={kpis.billing} format={formatIDR} delta={deltas.billing} spark={monthly.map((m) => m.billing)} />
        <KpiCard index={6} loading={isLoading} label="Approved (IDR)" accent="#0F9488" value={kpis.approved} format={formatIDR} delta={deltas.approved} subline={`${formatRatioPct(kpis.approvedPct)} of billing`} spark={monthly.map((m) => m.approved)} />
      </div>

      {/* Sections 2 + 4 — relationship & demographic side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div variants={sectionVariants}>
          <SectionCard title="Claimants Relationship" className="h-full">
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <div className="space-y-4 py-2">
                {relationships.map((r: RelationshipRow, i: number) => (
                  <div key={r.relationship} className="group">
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="text-[12.5px] font-bold text-[#1F2A37]">
                        {r.relationship} <span className="ml-1 font-medium text-[#9CA3AF]">· {formatRatioPct(r.claimants / relTotal)}</span>
                      </span>
                      <span className="text-[13px] font-bold tabular-nums text-[#1F2A37]">{formatNumber(r.claimants)}</span>
                    </div>
                    <div className="h-6 w-full rounded-md bg-[#F1F3F5]">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: i * 0.08, duration: 0.65, ease: "easeOut" }}
                        className="h-full origin-left rounded-md transition-[filter] duration-150 group-hover:brightness-110"
                        style={{ width: `${(r.claimants / relMax) * 100}%`, backgroundColor: REL_COLORS[r.relationship] ?? "#60A5FA" }}
                        title={`${r.relationship} — ${formatNumber(r.claimants)} claimants (${formatRatioPct(r.claimants / relTotal)})`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </motion.div>

        <motion.div variants={sectionVariants}>
          <SectionCard title="Claimants Demographic" className="h-full">
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    { label: "Female", total: totalFemale, color: F_PINK, key: "female" as const },
                    { label: "Male", total: totalMale, color: M_BLUE, key: "male" as const },
                  ]
                ).map((panel) => (
                  <motion.div
                    key={panel.label}
                    initial={{ opacity: 0, x: panel.key === "female" ? -24 : 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: `${panel.color}22` }}>
                        <User className="h-3.5 w-3.5" style={{ color: panel.color }} />
                      </span>
                      <span className="text-[12.5px] font-bold text-[#1F2A37]">{panel.label}</span>
                      <span className="ml-auto text-[12px] font-semibold tabular-nums text-[#4B5563]">{formatNumber(panel.total)}</span>
                    </div>
                    <div className="space-y-1.5">
                      {ageGender.map((r, i) => (
                        <div key={r.bucket} className="flex items-center gap-2">
                          <span className="w-10 text-right text-[11px] font-semibold text-[#4B5563]">{AGE_BUCKETS[i]}</span>
                          <div className="h-4 flex-1 rounded bg-[#F1F3F5]">
                            <motion.div
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ delay: 0.1 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                              className="h-full origin-left rounded"
                              style={{ width: `${(r[panel.key] / ageMax) * 100}%`, backgroundColor: panel.color }}
                            />
                          </div>
                          <span className="w-8 text-[11px] font-bold tabular-nums text-[#1F2A37]">{formatNumber(r[panel.key])}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </SectionCard>
        </motion.div>
      </div>

      {/* Section 3 — Most Frequent Diseases */}
      <motion.div variants={sectionVariants}>
        <SectionCard title="Most Frequent Diseases">
          {isLoading ? (
            <Skeleton className="h-[380px] w-full" />
          ) : (
            <div className="space-y-3">
              {groups.map((g, i) => {
                const bubbleSize = 44 + Math.sqrt(g.approved / bubbleMax) * 34;
                return (
                  <div key={g.group} className="group grid grid-cols-[minmax(180px,280px)_1fr] items-center gap-3">
                    <div className="truncate pr-2 text-right text-[12.5px] font-semibold text-[#1F2A37]" title={g.group}>
                      {g.group}
                    </div>
                    <div className="relative flex h-9 items-center">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: i * 0.06, duration: 0.7, ease: "easeOut" }}
                        className="h-full origin-left rounded-r-md transition-[filter] duration-150 group-hover:brightness-105"
                        style={{ width: `${Math.max(2, (g.claimants / groupMax) * 82)}%`, backgroundColor: DISEASE_CYAN }}
                        title={`${g.group} · ${formatNumber(g.claimants)} claimants · ${formatNumber(g.transactions)} transactions · Approved IDR ${formatIDR(g.approved)} · Avg LOS ${formatDecimal(g.avgLos)} days`}
                      >
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11.5px] font-bold tabular-nums text-white">
                          {formatNumber(g.claimants)}
                        </span>
                      </motion.div>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 + i * 0.06, type: "spring", stiffness: 300, damping: 18 }}
                        className="ml-2 flex shrink-0 items-center justify-center rounded-full text-center text-white shadow-md transition-transform duration-150 group-hover:scale-105"
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

      {/* Section 5 — Diagnosis Detail */}
      <motion.div variants={sectionVariants}>
        <SectionCard
          title="Diagnosis Detail"
          right={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/70" />
              <input
                value={diagSearch}
                onChange={(e) => setDiagSearch(e.target.value)}
                placeholder="Search ICD-10 / description…"
                className="h-8 w-56 rounded-md border border-white/30 bg-white/10 pl-8 pr-3 text-[12.5px] font-medium text-white outline-none placeholder:text-white/70 focus:bg-white/20"
              />
            </div>
          }
        >
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <>
              <DataTable
                columns={diagColumns}
                rows={visibleDiagnoses}
                rowKey={(r) => r.code}
                maxHeight={480}
                footer={[
                  "Total",
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
              <button onClick={() => setShowAllDiag((s) => !s)} className="mt-3 text-[12.5px] font-semibold text-[#1D4ED8] hover:underline">
                {showAllDiag ? "Show top 15 only" : `Show all ${formatNumber(diagnoses.length)} diagnoses`}
              </button>
            </>
          )}
        </SectionCard>
      </motion.div>

      {/* Section 6 — Export */}
      <motion.div variants={sectionVariants} className="flex items-center justify-end">
        <ExportButton
          filename="adbrief-diseases.csv"
          getPayload={() => ({
            headers: ["ICD-10", "Description", "Group", "Total Approved (IDR)", "Total Transaction", "Avg Transaksi/Claimant", "Avg Approved/Claimant (IDR)", "Avg LOS (days)"],
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
      </motion.div>
      </div>
    </motion.div>
  );
}

function PageTitle() {
  return (
    <div>
      <h1 className="font-display text-[28px] font-extrabold text-[#1F2A37] md:text-[32px]">The Most Frequent Diseases</h1>
      <p className="mt-1 text-sm italic text-[#9CA3AF]">
        Diagnosis mix, claimant relationships, and cost per condition based on primary ICD-10 codes
      </p>
    </div>
  );
}