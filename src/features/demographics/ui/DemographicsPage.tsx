/**
 * Indemnity — Demographics (Member & Claimants Demographics)
 *
 * Content unchanged (age/gender heatmap, relationship bars, butterfly chart).
 * Layout & style follow OverviewPage: live-clock header + rolling KPI cards.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, BadgeCheck, Receipt, UserCheck, Wallet } from "lucide-react";
import BoardKpiCard from "@/shared/components/common/BoardKpiCard";
import FilterBoardHeader from "@/shared/components/common/FilterBoardHeader";
import SectionCard from "@/shared/components/common/SectionCard";
import { useExportEnabled } from "@/entities/settings/model/useSettings";
import EmptyState from "@/shared/components/common/EmptyState";
import ApiError from "@/shared/components/error/ApiError";
import { Skeleton } from "@/shared/ui/skeleton";
import { useIndemnityData } from "@/features/indemnity-overview/hooks/useIndemnityData";
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
  const { data, isLoading, isFetching, isError, refetch } = useIndemnityData();
  const exportEnabled = useExportEnabled();

  const filteredClaims = data?.claims;
  const members = data?.members;

  const kpis = useMemo(() => kpiSummary(filteredClaims ?? [], members ?? []), [filteredClaims, members]);
  const deltas = useMemo(() => kpiDeltas(filteredClaims ?? [], members ?? []), [filteredClaims, members]);
  const monthly = useMemo(() => byMonth(filteredClaims ?? []), [filteredClaims]);
  const relationships = useMemo(() => byRelationship(members ?? [], filteredClaims ?? []), [members, filteredClaims]);

  const memberMatrix = useMemo(() => memberAgeGender(members ?? []), [members]);
  const claimantMatrix = useMemo(
    () => claimantAgeGender(members ?? [], filteredClaims ?? []),
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

  const cards = useMemo(
    () => [
      {
        id: "claimants",
        label: t("demographics.claimants"),
        value: formatNumber(kpis.claimants),
        icon: UserCheck,
        sublabel: t("demographics.claimantsSub"),
        iconBg: "bg-[#FFF7ED]",
        iconColor: "text-[#EA8C1F]",
        dotColor: "bg-[#EA8C1F]",
        topBorder: "border-t-[#EA8C1F]",
        accent: "#EA8C1F",
        delta: deltas.claimants,
      },
      {
        id: "transactions",
        label: t("demographics.transactions"),
        value: formatNumber(kpis.transactions),
        icon: Receipt,
        sublabel: t("demographics.transactionsSub"),
        iconBg: "bg-[#FFFBEB]",
        iconColor: "text-[#D9A400]",
        dotColor: "bg-[#D9A400]",
        topBorder: "border-t-[#D9A400]",
        accent: "#D9A400",
        delta: deltas.transactions,
      },
      {
        id: "avgTxn",
        label: t("demographics.avgTxnPerClaimant"),
        value: formatDecimal(kpis.avgTxnPerClaimant),
        icon: Activity,
        sublabel: t("demographics.avgTxnSub"),
        iconBg: "bg-[#EFF6FF]",
        iconColor: "text-[#2563EB]",
        dotColor: "bg-[#2563EB]",
        topBorder: "border-t-[#2563EB]",
        accent: "#2563EB",
      },
      {
        id: "avgApproved",
        label: t("demographics.avgApprovedPerClaimant"),
        value: formatIDR(kpis.avgApprovedPerClaimant),
        icon: BadgeCheck,
        sublabel: t("demographics.avgApprovedSub"),
        iconBg: "bg-[#F5F3FF]",
        iconColor: "text-[#7C3AED]",
        dotColor: "bg-[#7C3AED]",
        topBorder: "border-t-[#7C3AED]",
        accent: "#7C3AED",
      },
      {
        id: "billing",
        label: t("demographics.billing"),
        value: formatIDR(kpis.billing),
        icon: Wallet,
        sublabel: t("demographics.billingSub"),
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
        label: t("demographics.approved"),
        value: formatIDR(kpis.approved),
        icon: BadgeCheck,
        sublabel: `${formatRatioPct(kpis.approvedPct)} ${t("demographics.ofBilling")}`,
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

  const exportPayload = () => ({
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
  });

  if (isError) return <ApiError onRetry={refetch} />;

  if (!isLoading && (filteredClaims?.length ?? 0) === 0) {
    return (
      <div className="flex h-full flex-col gap-3">
        <FilterBoardHeader
          title={t("demographics.title")}
          subtitle={t("demographics.subtitle")}
          isFetching={isFetching}
          exportEnabled={exportEnabled}
          filename={`adbrief-demographics-${periode}.csv`}
          getPayload={exportPayload}
        />
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
    <motion.div
      className="flex h-full flex-col gap-3 transition-opacity duration-300"
      style={{ opacity: isFetching && !isLoading ? 0.55 : 1 }}
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      <FilterBoardHeader
        title={t("demographics.title")}
        subtitle={t("demographics.subtitle")}
        isFetching={isFetching}
        exportEnabled={exportEnabled}
        filename={`adbrief-demographics-${periode}.csv`}
        getPayload={exportPayload}
      />

      <motion.div variants={sectionVariants} className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card, index) => (
          <BoardKpiCard key={card.id} index={index} {...card} />
        ))}
      </motion.div>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
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
                  <table className="w-full font-sans text-[10px]">
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
