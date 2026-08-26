/**
 * Daily Monitoring Page — Manage Care dashboard based on design_managecare.tsx layout.
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetDailyMonitoringQuery, type DailyMonitoringItem } from '@/entities/monitoring/api/monitoringApi';
import { useGetPayorsQuery } from '@/entities/payor/api/payorApi';
import { useAppSelector } from '@/shared/store';
import { useHasRole } from '@/entities/auth/model/useRbac';
import {
  Activity,
  Building2,
  FileSpreadsheet,
  LogOut,
  Maximize2,
  Minimize2,
  ShieldAlert,
  UserCheck,
  PlusCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import ApiError from '@/shared/components/error/ApiError';
import PageLoader from '@/shared/components/loading/PageLoader';

/** Format Date to YYYY-MM-DD */
function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Rolling Digit Component
function RollingDigit({ digit, delay }: { digit: string; delay: number }) {
  const [target, setTarget] = useState(0);

  useEffect(() => {
    const num = parseInt(digit, 10);
    if (!isNaN(num)) {
      const timer = setTimeout(() => {
        setTarget(num);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [digit]);

  if (isNaN(parseInt(digit, 10))) {
    return <span className="inline-block">{digit}</span>;
  }

  return (
    <div className="relative inline-block h-[1em] overflow-hidden leading-none">
      <div
        className="flex flex-col transition-transform transition-duration-[2000ms] cubic-bezier(0.34,1.56,0.64,1)"
        style={{
          transform: `translateY(-${target * 10}%)`,
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
  const digits = value.toString().split('');

  return (
    <div className="inline-flex items-center">
      {digits.map((digit, index) => (
        <RollingDigit key={index} digit={digit} delay={index * 0.1} />
      ))}
    </div>
  );
}

export default function DailyMonitoring() {
  const { t } = useTranslation();
  // ── Auth & RBAC ──
  const user = useAppSelector((s) => s.auth.user);
  const isManageCare = useHasRole('MANAGECARE') || useHasRole('SUPER_ADMIN') || useHasRole('ADMIN');

  // ── Fetch all payors to resolve payorIds → payor_code ──
  const { data: payorsData } = useGetPayorsQuery({ page: 1, pageSize: 999 }, { skip: !isManageCare });

  // ── Resolve payor_code: first MANAGE_CARE payor matching user's payorIds ──
  const payorCode = useMemo(() => {
    if (!isManageCare || !user?.payorIds?.length) return '';
    const allPayors = payorsData?.data ?? [];
    const match = allPayors.find((p) => p.category === 'MANAGE_CARE' && user.payorIds.includes(p.id));
    return match?.code ?? '';
  }, [payorsData, user?.payorIds, isManageCare]);

  // ── Compute date range: 30 days ago → now ──
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startDate: formatDate(thirtyDaysAgo), endDate: formatDate(now) };
  }, []);

  // ── Daily monitoring query (only if MANAGE_CARE payor_code exists) ──
  const { data: responseData, isLoading, isError, refetch } = useGetDailyMonitoringQuery(
    { payor_code: payorCode, start_date: startDate, end_date: endDate },
    { skip: !payorCode },
  );

  const [currentTime, setCurrentTime] = useState<string>('');
  const [isMainTableFullscreen, setIsMainTableFullscreen] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const patientTableRef = useRef<HTMLDivElement | null>(null);
  const leftColRef = useRef<HTMLDivElement | null>(null);
  const rightColRef = useRef<HTMLDivElement | null>(null);

  // Live time update
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${dd}-${mm}-${yyyy} | ${hh}:${min}:${ss}`);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto scroll table container (Trend Diagnosa)
  useEffect(() => {
    const scrollInterval = setInterval(() => {
      if (tableContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 1) {
          tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          tableContainerRef.current.scrollBy({ top: 50, behavior: 'smooth' });
        }
      }
    }, 5000);

    return () => clearInterval(scrollInterval);
  }, []);

  // Auto scroll patient list table
  useEffect(() => {
    const scrollInterval = setInterval(() => {
      if (patientTableRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = patientTableRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 1) {
          patientTableRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          patientTableRef.current.scrollBy({ top: 50, behavior: 'smooth' });
        }
      }
    }, 8000);

    return () => clearInterval(scrollInterval);
  }, []);

  // Refetch data every 10 mins
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 600000);
    return () => clearInterval(interval);
  }, [refetch]);

  const items: DailyMonitoringItem[] = useMemo(() => {
    return Array.isArray(responseData?.data) ? responseData.data : [];
  }, [responseData]);

  // Sync Trend Diagnosa height to KPI Cards column on lg+ screens
  useEffect(() => {
    const leftCol = leftColRef.current;
    const rightCol = rightColRef.current;
    if (!leftCol || !rightCol) return;

    const syncHeight = () => {
      if (window.innerWidth >= 1024) {
        const leftHeight = leftCol.getBoundingClientRect().height;
        rightCol.style.height = `${leftHeight}px`;
      } else {
        rightCol.style.height = '';
      }
    };

    const observer = new ResizeObserver(syncHeight);
    observer.observe(leftCol);
    window.addEventListener('resize', syncHeight);
    syncHeight();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncHeight);
    };
  }, [items]);

  // Aggregated KPI Stats
  const stats = useMemo(() => {
    const dataClaimStatus = items.map((item: DailyMonitoringItem) => item?.header?.ClaimStatus) || [];
    const totalDHC = dataClaimStatus.filter((item: string) => item === 'DHC').length;
    const totalDMO = dataClaimStatus.filter((item: string) => item === 'DMO').length;
    const totalReject = dataClaimStatus.filter((item: string) => item !== 'DMO' && item !== 'DHC').length;
    const totalProviderDHC = new Set(
      items.map((item: DailyMonitoringItem) => item?.header?.ProviderID).filter(Boolean),
    ).size;
    const dataAdmission = items.map((item: DailyMonitoringItem) => item?.header?.AdmissionDate) || [];
    const totalAdmissionValid = dataAdmission.filter(Boolean).length || 0;

    return {
      totalDMO,
      totalProviderDHC,
      totalAdmissionValid,
      totalDHC,
      totalReject,
    };
  }, [items]);

  // Trend Diagnosa Grouping
  const diagnosisTrend = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const desc = item.header?.ICDXDesc || '-';
      if (desc && desc.trim() !== '' && desc !== '-') {
        counts[desc] = (counts[desc] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [items]);

  // Patient List (DMO status sorted by Days)
  const patientList = useMemo(() => {
    return items
      .filter((item: DailyMonitoringItem) => item?.header?.ClaimStatus === 'DMO')
      .sort((a: DailyMonitoringItem, b: DailyMonitoringItem) => (Number(b.header?.Days) || 0) - (Number(a.header?.Days) || 0));
  }, [items]);

  // Cards Configuration
  const cards = [
    {
      id: 'C1',
      label: t('dailyMonitoring.monitoringPasien'),
      value: stats.totalDMO,
      icon: UserCheck,
      bgGradient: 'from-[#11998e] to-[#38ef7d]',
    },
    {
      id: 'C3',
      label: t('dailyMonitoring.totalAdmission'),
      value: stats.totalAdmissionValid,
      icon: PlusCircle,
      bgGradient: 'from-[#0072ff] to-[#00c6ff]',
    },
    {
      id: 'C4',
      label: t('dailyMonitoring.totalDischarge'),
      value: stats.totalDHC,
      icon: LogOut,
      bgGradient: 'from-[#ff4b1f] to-[#ff9068]',
    },
    {
      id: 'C2',
      label: t('dailyMonitoring.totalProvider'),
      value: stats.totalProviderDHC,
      icon: Building2,
      bgGradient: 'from-[#0072ff] to-[#00c6ff]',
    },
    {
      id: 'C5',
      label: t('dailyMonitoring.totalRejected'),
      value: stats.totalReject,
      icon: ShieldAlert,
      bgGradient: 'from-[#c0392b] to-[#e74c3c]',
    },
  ];

  // ── Early returns (after all hooks) ──
  if (isLoading) return <PageLoader />;
  if (isError) return <ApiError onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-5 shadow-sm border border-[#E5E8EC]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2E7D5B]/10 text-[#2E7D5B]">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-[#1F2A37]">{t('dailyMonitoring.title')}</h1>
              <span className="rounded-full bg-[#E7F4EE] px-2.5 py-0.5 text-xs font-semibold text-[#2E7D5B]">
                {t('dailyMonitoring.thirtyDays')}
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">{t('dailyMonitoring.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg bg-[#F4F6F8] px-3.5 py-2 text-xs font-medium text-[#4B5563]">
            <Clock className="h-4 w-4 text-[#2E7D5B]" />
            <span>{t('dailyMonitoring.lastUpdate')}: {currentTime || t('dailyMonitoring.loading')}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left (KPI Cards) & Right (Trend Diagnosa) */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* KPI Cards (7 cols on lg) */}
        <div ref={leftColRef} className="lg:col-span-7 flex flex-col gap-4">
          {/* 4 Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cards.slice(0, 4).map((card) => {
              const IconComp = card.icon;
              return (
                <div
                  key={card.id}
                  className={cn(
                    'relative overflow-hidden rounded-xl bg-gradient-to-br p-5 text-white shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
                    card.bgGradient,
                  )}
                >
                  <IconComp className="absolute -bottom-4 -left-4 h-24 w-24 opacity-20 pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold tracking-wide">{card.label}</span>
                    <IconComp className="h-6 w-6 opacity-90" />
                  </div>
                  <div className="mt-4 text-right text-4xl font-extrabold tracking-tight">
                    <RollingCounter value={card.value} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 5th Card: Total Rejected */}
          <div
            className={cn(
              'relative overflow-hidden rounded-xl bg-gradient-to-br p-4 text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
              cards[4].bgGradient,
            )}
          >
            <ShieldAlert className="absolute -bottom-4 -left-4 h-20 w-20 opacity-20 pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold tracking-wide">{cards[4].label}</span>
              <ShieldAlert className="h-6 w-6 opacity-90" />
            </div>
            <div className="mt-2 text-right text-3xl font-extrabold tracking-tight">
              <RollingCounter value={cards[4].value} />
            </div>
          </div>
        </div>

        {/* Trend Diagnosa (5 cols on lg) */}
        <div ref={rightColRef} className="lg:col-span-5 flex flex-col overflow-hidden rounded-xl bg-white p-4 shadow-sm border border-[#E5E8EC]">
          <h2 className="mb-3 shrink-0 text-center text-lg font-bold text-[#1F2A37]">{t('dailyMonitoring.trendDiagnosa')}</h2>
          <div
            ref={tableContainerRef}
            className="flex-1 overflow-y-auto rounded-lg border border-[#E5E8EC]"
          >
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 bg-gradient-to-r from-[#10B981] to-[#3B82F6] text-white">
                <tr>
                  <th className="px-4 py-2.5 font-bold">{t('dailyMonitoring.diagnosa')}</th>
                  <th className="px-4 py-2.5 font-bold text-center whitespace-nowrap">{t('dailyMonitoring.totalPasien')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {diagnosisTrend.length > 0 ? (
                  diagnosisTrend.map(([ICDXDesc, total], idx) => (
                    <tr
                      key={idx}
                      className={cn(
                        'transition-colors hover:bg-[#E7F4EE]/50',
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                      )}
                    >
                      <td className="px-4 py-2 text-[#4B5563] font-medium text-xs sm:text-sm">{ICDXDesc}</td>
                      <td className="px-4 py-2 text-center font-bold text-[#1F2A37] bg-gray-100/50">
                        {total}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-sm text-[#9CA3AF]">
                      {t('dailyMonitoring.noDiagnosisData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Main Section: Pasien List Table */}
      <div
        className={cn(
          'flex flex-col rounded-xl bg-white p-5 shadow-sm border border-[#E5E8EC] transition-all duration-200',
          isMainTableFullscreen && 'fixed inset-0 z-50 rounded-none p-6 overflow-hidden',
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#2E7D5B]" />
            <h2 className="text-xl font-bold text-[#1F2A37]">{t('dailyMonitoring.pasienList')}</h2>
            <span className="rounded-full bg-[#E7F4EE] px-2.5 py-0.5 text-xs font-semibold text-[#2E7D5B]">
              {patientList.length} {t('dailyMonitoring.dmoPatients')}
            </span>
          </div>

          <button
            onClick={() => setIsMainTableFullscreen((prev) => !prev)}
            className="flex items-center gap-1.5 rounded-lg border border-[#E5E8EC] px-3 py-1.5 text-xs font-semibold text-[#4B5563] hover:bg-[#F4F6F8] hover:text-[#1F2A37] transition"
            title={isMainTableFullscreen ? t('dailyMonitoring.exitFullscreen') : t('dailyMonitoring.fullscreen')}
          >
            {isMainTableFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4" />
                <span>{t('dailyMonitoring.exitFullscreen')}</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                <span>{t('dailyMonitoring.fullscreen')}</span>
              </>
            )}
          </button>
        </div>

        {/* Patient Table Container */}
        <div
          ref={patientTableRef}
          className={cn(
            'flex-1 overflow-auto rounded-lg border border-[#E5E8EC]',
            isMainTableFullscreen ? 'max-h-[calc(100vh-120px)]' : 'max-h-[480px]',
          )}
        >
          <table className="w-full text-left text-sm border-collapse">
            <thead className="sticky top-0 bg-gradient-to-r from-[#10B981] to-[#3B82F6] text-white z-10">
              <tr>
                <th className="px-4 py-3 font-bold text-center">{t('dailyMonitoring.npp')}</th>
                <th className="px-4 py-3 font-bold">{t('dailyMonitoring.namaPasien')}</th>
                <th className="px-4 py-3 font-bold text-center">{t('dailyMonitoring.principleDependent')}</th>
                <th className="px-4 py-3 font-bold text-center">{t('dailyMonitoring.namaProvider')}</th>
                <th className="px-4 py-3 font-bold text-center">{t('dailyMonitoring.tanggalMasuk')}</th>
                <th className="px-4 py-3 font-bold text-center">{t('dailyMonitoring.lamaRanap')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E8EC]">
              {patientList.length > 0 ? (
                patientList.map((item: DailyMonitoringItem, idx: number) => {
                  const h = item.header;
                  const pdText = h.PD === 'P' ? t('dailyMonitoring.principle') : h.PD === 'D' ? t('dailyMonitoring.dependent') : '-';
                  return (
                    <tr
                      key={idx}
                      className="hover:bg-[#E7F4EE]/40 transition-colors font-medium text-[#4B5563]"
                    >
                      <td className="px-4 py-3 text-center text-[#1F2A37] font-semibold">
                        {h.MemberID || '-'}
                      </td>
                      <td className="px-4 py-3 text-[#1F2A37] font-semibold">
                        {h.MemberName || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            h.PD === 'P'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200',
                          )}
                        >
                          {pdText}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{h.ProviderName || '-'}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {h.AdmissionDate || '-'}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-[#2E7D5B]">
                        {h.Days != null ? `${h.Days} ${t('dailyMonitoring.hari')}` : '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#9CA3AF]">
                    {t('dailyMonitoring.noActiveDmo')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-2 rounded-xl bg-[#1F2A37] py-3 text-center text-xs text-gray-400">
        {t('dailyMonitoring.footer')}
      </footer>
    </div>
  );
}