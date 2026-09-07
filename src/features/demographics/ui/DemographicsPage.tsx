/**
 * Indemnity — Demographics (Member & Claimants Demographics)
 *
 * Age and gender composition of active members versus claimants within
 * the currently selected period (W1–W4 / Month / Custom, max 31 days).
 *
 * Concept: "check for daily" — the selected period is treated as a single
 * snapshot. There is no first-half → second-half %Growth comparison.
 *
 * Data comes from the AdmDailyClaim API response — no year-based splitting.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import KpiCard from "@/shared/components/common/KpiCard";
import SectionCard from "@/shared/components/common/SectionCard";
import ExportButton from "@/shared/components/common/ExportButton";
import { useExportEnabled } from "@/entities/settings/model/useSettings";
import EmptyState from "@/shared/components/common/EmptyState";
import ApiError from "@/shared/components/error/ApiError";
import { Skeleton } from "@/shared/ui/skeleton";
import { useIndemnityData } from "@/features/indemnity-overview/hooks/useIndemnityData";
import PeriodFilter from "@/features/indemnity-overview/components/PeriodFilter";
import { AGE_BUCKETS, byMonth, byRelationship, kpiDeltas, kpiSummary } from "@/entities/claim/lib/aggregate";
import type { RelationshipRow } from "@/entities/claim/lib/aggregate";
import {
  claimantAgeGender,
  memberAgeGender,
} from "@/features/indemnity-overview/utils/demoAgg";
import type { AgeGenderCell } from "@/features/indemnity-overview/utils/demoAgg";
import { cn } from "@/shared/lib/utils";
import { formatDecimal, formatIDR, formatNumber, formatRatioPct } from "@/shared/lib/format";
import { useTranslation } from "react-i18next";

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

const F_PINK = "#EC6FA0";
const M_BLUE = "#3B82F6";
const REL_COLORS: Record<string, string> = { PRINCIPLE: "#1D4ED8", CHILD: "#3B82F6", SPOUSE: "#93C5FD" };
const HEAT_SCALE = ["#EFF6FF", "#DBEAFE", "#BFDBFE", "#93C5FD", "#60A5FA", "#3B82F6", "#1D4ED8"];

function heatColor(v: number, max: number): string {
  if (max <= 0 || v <= 0) return HEAT_SCALE[0];
  const t = Math.sqrt(v / max);
  return HEAT_SCALE[Math.min(HEAT_SCALE.length - 1, Math.floor(t * HEAT_SCALE.length))];
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
  const relationships = useMemo(() => byRelationship(members, filteredClaims), [members, filteredClaims]);

  // Age × gender matrices for the selected period (single daily snapshot).
  const memberMatrix = useMemo(
    () => memberAgeGender(members),
    [members],
  );
  const claimantMatrix = useMemo(
    () => claimantAgeGender(members, filteredClaims),
    [members, filteredClaims],
  );

  const memberMax = useMemo(
    () => Math.max(1, ...memberMatrix.flatMap((r) => [r.female, r.male])),
    [memberMatrix],
  );
  const claimantMax = useMemo(
    () => Math.max(1, ...claimantMatrix.flatMap((r) => [r.female, r.male])),
    [claimantMatrix],
  );

  const relTotal = relationships.reduce((s, r) => s + r.claimants, 0) || 1;
  const relMax = Math.max(1, ...relationships.map((r) => r.claimants));

  const periode = "demographics";

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
                  filename={`adbrief-demographics-${periode}.csv`}
                  getPayload={() => ({
                    headers: [
                      t("demographics.ageGroup"),
                      t("demographics.memberFemale"), t("demographics.memberMale"), t("demographics.memberTotal"),
                      t("demographics.claimantsFemale"), t("demographics.claimantsMale"), t("demographics.claimantsTotal"),
                    ],
                    rows: AGE_BUCKETS.map((b, i) => {
                      const m = memberMatrix[i];
                      const c = claimantMatrix[i];
                      return [
                        b,
                        m.female, m.male, m.total,
                        c.female, c.male, c.total,
                      ] as (string | number)[];
                    }),
                  })}
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <SectionCard title={t("demographics.title")} className="h-full">
            <EmptyState />
          </SectionCard>
        </div>
      </div>
    );
  }
  const sumOf = (rows: AgeGenderCell[], key: "female" | "male") => rows.reduce((s, r) => s + r[key], 0);
  const sumTotal = (rows: AgeGenderCell[]) => rows.reduce((s, r) => s + r.total, 0);

  return (
    <motion.div className="flex h-full flex-col gap-3 transition-opacity duration-300" style={{ opacity: isFetching && !isLoading ? 0.55 : 1 }} initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                    t("demographics.claimantsFemale"), t("demographics.claimantsMale"), t("demographics.claimantsTotal"),
                  ],
                  rows: AGE_BUCKETS.map((b, i) => {
                    const m = memberMatrix[i];
                    const c = claimantMatrix[i];
                    return [
                      b,
                      m.female, m.male, m.total,
                      c.female, c.male, c.total,
                    ] as (string | number)[];
                  }),
                })}
              />
            </>
          )}
        </div>
      </div>

        {/* Section 1 — KPI row */}
        <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard index={0} loading={isLoading} label={t("demographics.claimants")} accent="#EA8C1F" value={kpis.claimants} format={formatNumber} delta={deltas.claimants} />
          <KpiCard index={1} loading={isLoading} label={t("demographics.transactions")} accent="#D9A400" value={kpis.transactions} format={formatNumber} delta={deltas.transactions} />
          <KpiCard index={2} loading={isLoading} label={t("demographics.avgTxnPerClaimant")} accent="#2563EB" value={kpis.avgTxnPerClaimant} format={formatDecimal} />
          <KpiCard index={3} loading={isLoading} label={t("demographics.avgApprovedPerClaimant")} accent="#7C3AED" value={kpis.avgApprovedPerClaimant} format={formatIDR} />
          <KpiCard index={4} loading={isLoading} label={t("demographics.billing")} accent="#9B2226" value={kpis.billing} format={formatIDR} delta={deltas.billing} spark={monthly.map((m) => m.billing)} />
          <KpiCard index={5} loading={isLoading} label={t("demographics.approved")} accent="#0F9488" value={kpis.approved} format={formatIDR} delta={deltas.approved} subline={`${formatRatioPct(kpis.approvedPct)} ${t("demographics.ofBilling")}`} spark={monthly.map((m) => m.approved)} />
        </div>

        {/* ── Row 2 & 3 — stacked, fill remaining viewport height ── */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Section 2 — Member heatmap table + Claimants Relationship side by side */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Member heatmap table */}
          <motion.div variants={sectionVariants} className="min-h-0">
            <SectionCard
              title={t("demographics.memberByAgeGender")}
              subtitle={t("demographics.memberByAgeGenderSubtitle")}
              className="h-full"
              bodyClassName="flex min-h-0 flex-col p-4"
            >
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[#E5E8EC]">
                  <table className="w-full text-[10px] font-sans">
                    <thead>
                      <tr className="bg-[#F1F3F5] text-[11px] font-bold uppercase tracking-wide text-[#4B5563]">
                        <th className="px-4 py-0.5 text-left">{t("demographics.ageGroup")}</th>
                        <th className="border-l border-[#E5E8EC] px-4 py-0.5 text-center" style={{ color: F_PINK }}>{t("demographics.female")}</th>
                        <th className="border-l border-[#E5E8EC] px-4 py-0.5 text-center" style={{ color: M_BLUE }}>{t("demographics.male")}</th>
                        <th className="border-l border-[#E5E8EC] px-4 py-0.5 text-center">{t("demographics.total")}</th>
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
                            className="block rounded px-2 py-0.5 text-right font-semibold tabular-nums"
                            style={{ backgroundColor: heatColor(v, memberMax), color: v / memberMax > 0.45 ? "#fff" : "#1F2A37" }}
                          >
                            {formatNumber(v)}
                          </motion.span>
                        );
                        return (
                          <tr key={b} className="border-t border-[#E5E8EC] hover:bg-[#F8FAFB]">
                            <td className="px-4 py-1 font-semibold text-[#1F2A37]">{b}</td>
                            <td className="border-l border-[#E5E8EC] px-2 py-0.5">{cell(row.female)}</td>
                            <td className="border-l border-[#E5E8EC] px-2 py-0.5">{cell(row.male)}</td>
                            <td className="border-l border-[#E5E8EC] px-4 py-1 text-right font-bold tabular-nums text-[#1F2A37]">{formatNumber(row.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#E5E8EC] font-bold text-[#1F2A37]">
                        <td className="px-4 py-1.5">{t("demographics.total")}</td>
                        <td className="border-l border-[#E5E8EC] px-4 py-1.5 text-right tabular-nums">{formatNumber(sumOf(memberMatrix, "female"))}</td>
                        <td className="border-l border-[#E5E8EC] px-4 py-1.5 text-right tabular-nums">{formatNumber(sumOf(memberMatrix, "male"))}</td>
                        <td className="border-l border-[#E5E8EC] px-4 py-1.5 text-right tabular-nums">{formatNumber(sumTotal(memberMatrix))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </SectionCard>
          </motion.div>

          {/* Claimants Relationship */}
          <motion.div variants={sectionVariants} className="min-h-0">
            <SectionCard title={t("diseases.claimantsRelationship")} className="h-full" bodyClassName="flex min-h-0 flex-col p-4">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-1">
                  {relationships.map((r: RelationshipRow, i: number) => (
                    <div key={r.relationship} className="group">
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-[12.5px] font-bold text-[#1F2A37]">
                          {r.relationship} <span className="ml-1 font-medium text-[#9CA3AF]">· {formatRatioPct(r.claimants / relTotal)}</span>
                        </span>
                        <span className="text-[13px] font-bold tabular-nums text-[#1F2A37]">{formatNumber(r.claimants)}</span>
                      </div>
                      <div className="h-5 w-full rounded-md bg-[#F1F3F5]">
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: i * 0.08, duration: 0.65, ease: "easeOut" }}
                          className="h-full origin-left rounded-md transition-[filter] duration-150 group-hover:brightness-110"
                          style={{ width: `${(r.claimants / relMax) * 100}%`, backgroundColor: REL_COLORS[r.relationship] ?? "#60A5FA" }}
                          title={`${r.relationship} — ${formatNumber(r.claimants)} ${t("diseases.claimantsBar")} (${formatRatioPct(r.claimants / relTotal)})`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </motion.div>
        </div>

        {/* Section 3 — Claimants butterfly chart */}
        <motion.div variants={sectionVariants} className="min-h-0 flex-1">
          <SectionCard
            title={t("demographics.claimantsByAgeGender")}
            subtitle={t("demographics.claimantsByAgeGenderSubtitle")}
            className="h-full"
            bodyClassName="flex min-h-0 flex-col p-4"
          >
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                <div className="mb-2 flex items-center justify-center gap-6 text-[11.5px] font-semibold text-[#4B5563]">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: F_PINK }} /> {t("demographics.female")}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: M_BLUE }} /> {t("demographics.male")}</span>
                </div>
                {AGE_BUCKETS.map((b, i) => {
                  const row = claimantMatrix[i];
                  const bar = (v: number, color: string, side: "l" | "r") => (
                    <div className={cn("relative flex h-5 flex-1 items-center", side === "l" ? "justify-end" : "justify-start")}>
                      <motion.span
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.1 + Math.abs(3 - i) * 0.06, duration: 0.5, ease: "easeOut" }}
                        className={cn("relative h-5 rounded-md", side === "l" ? "origin-right rounded-r-none" : "origin-left rounded-l-none")}
                        style={{ width: `${Math.max(1, (v / claimantMax) * 100)}%`, backgroundColor: color }}
                      />
                      <span className={cn("absolute text-[11px] font-bold tabular-nums text-[#1F2A37]", side === "l" ? "-left-0.5 -translate-x-full pr-1" : "-right-0.5 translate-x-full pl-1")}>
                        {formatNumber(v)}
                      </span>
                    </div>
                  );
                  return (
                    <div key={b} className="group grid grid-cols-[1fr_64px_1fr] items-center gap-1 rounded-md px-1 py-0 hover:bg-[#F8FAFB]">
                      {bar(row.female, F_PINK, "l")}
                      <div className="flex flex-col items-center">
                        <span className="text-[11.5px] font-bold text-[#4B5563]">{b}</span>
                      </div>
                      {bar(row.male, M_BLUE, "r")}
                    </div>
                  );
                })}
              </div>
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
      <h1 className="font-display text-[24px] font-extrabold text-[#1F2A37] md:text-[28px]">{t("demographics.title")}</h1>
      <p className="mt-0.5 text-[13px] italic text-[#9CA3AF]">
        {t("demographics.subtitle")}
      </p>
    </div>
  );
}
