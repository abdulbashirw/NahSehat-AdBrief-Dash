/**
 * Dashboard — main overview page with KPIs and quick navigation.
 *
 * Premium animated background with flowing data-flow SVG,
 * pulsing glow orbs, data streams, floating particles, and shimmer sparkles.
 * Visual concept: "Data in Motion. Intelligence in Focus."
 * Color DNA: Light Blue + Electric Blue + Cyan + Teal
 */
import { useAuth } from '@/entities/auth/model/useAuth';
import { useHasRole } from '@/entities/auth/model/useRbac';
import KpiCard from '@/shared/components/common/KpiCard';
import SectionCard from '@/shared/components/common/SectionCard';
import ApiError from '@/shared/components/error/ApiError';
import DashboardBackground from '@/shared/components/common/DashboardBackground';
import { useIndemnityData } from '@/features/indemnity-overview/hooks/useIndemnityData';
import { formatIDR, formatNumber } from '@/shared/lib/format';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Shield,
  Settings,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMemo } from 'react';

export default function Dashboard() {
  const { user } = useAuth();
  const isSuperAdmin = useHasRole('SUPER_ADMIN');
  const isIndemnity = useHasRole('INDEMNITY');
  const isManageCare = useHasRole('MANAGECARE');
  const isAdmin = useHasRole('ADMIN');

  const { data: indemnityData, isLoading: indemnityLoading, isError: indemnityError, refetch } = useIndemnityData();

  const kpis = useMemo(() => {
    if (!indemnityData) return null;
    const { claims } = indemnityData;
    const totalClaims = claims.length;
    const totalIncurred = claims.reduce((s: number, c: { INCURRED: number }) => s + c.INCURRED, 0);
    const totalApproved = claims.reduce((s: number, c: { APPROVED: number }) => s + c.APPROVED, 0);
    const approvalRate = totalIncurred > 0 ? (totalApproved / totalIncurred) * 100 : 0;
    const uniqueMembers = new Set(claims.map((c: { MEMBERNO: string }) => c.MEMBERNO)).size;
    return { totalClaims, totalIncurred, totalApproved, approvalRate, uniqueMembers };
  }, [indemnityData]);

  const showIndemnity = isSuperAdmin || isIndemnity;
  const showManageCare = isSuperAdmin || isManageCare;
  const showCms = isSuperAdmin || isAdmin;

  return (
    <div className="relative min-h-full">
      {/* ── Animated background ── */}
      <DashboardBackground variant="dashboard" />

      {/* ── Content ── */}
      <div className="relative p-4 sm:p-6 lg:p-8">
        {/* ── Header ── */}
        <div className="animate-fade-in-up mb-8">
          <h1 className="text-2xl font-bold text-[#1E293B] sm:text-3xl">
            Welcome, {user?.fullName || 'User'}
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Here&apos;s an overview of your NahSehat Dashboard
          </p>
        </div>

        {/* ── Indemnity KPIs ── */}
        {showIndemnity && (
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <SectionCard
            title="Indemnity Overview"
            variant="light"
          >
            {indemnityError ? (
              <ApiError onRetry={refetch} variant="light" />
            ) : indemnityLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : kpis ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard
                    label="TOTAL CLAIMS"
                    accent="#06B6D4"
                    value={kpis.totalClaims}
                    format={formatNumber}
                    delta={0.125}
                    variant="light"
                  />
                  <KpiCard
                    label="TOTAL INCURRED"
                    accent="#2563EB"
                    value={kpis.totalIncurred}
                    format={formatIDR}
                    delta={0.083}
                    variant="light"
                  />
                  <KpiCard
                    label="TOTAL APPROVED"
                    accent="#14B8A6"
                    value={kpis.totalApproved}
                    format={formatIDR}
                    delta={-0.051}
                    variant="light"
                  />
                  <KpiCard
                    label="APPROVAL RATE"
                    accent="#06B6D4"
                    value={kpis.approvalRate / 100}
                    format={(n) => `${(n * 100).toFixed(1)}%`}
                    variant="light"
                  />
                </div>
                <div className="mt-4">
                  <KpiCard
                    label="UNIQUE MEMBERS"
                    accent="#2563EB"
                    value={kpis.uniqueMembers}
                    format={formatNumber}
                    variant="light"
                  />
                </div>
                <div className="mt-4 flex justify-end">
                  <Link
                    to="/indemnity/overview"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.25)] transition-all hover:bg-[#1D4ED8] hover:shadow-[0_4px_20px_rgba(37,99,235,0.35)]"
                  >
                    View Full Indemnity Dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </>
            ) : null}
          </SectionCard>
          </div>
        )}

        {/* ── Quick Navigation ── */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {showIndemnity && (
            <Link
              to="/indemnity/overview"
              className="animate-fade-in-scale group rounded-xl border border-[#E5E8EC] bg-white/90 p-6 shadow-[0_1px_3px_rgba(16,24,40,0.06)] backdrop-blur-sm transition-all duration-300 hover:border-[#06B6D4]/30 hover:bg-white hover:shadow-[0_4px_20px_rgba(6,182,212,0.12)]"
              style={{ animationDelay: '0.2s' }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#06B6D4]/10 text-[#06B6D4] transition-all duration-300 group-hover:bg-[#06B6D4] group-hover:text-white group-hover:shadow-[0_2px_10px_rgba(6,182,212,0.3)]">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#1E293B]">Indemnity Analytics</h3>
                  <p className="text-sm text-[#64748B]">Claims analysis & demographics</p>
                </div>
              </div>
            </Link>
          )}

          {showManageCare && (
            <Link
              to="/managecare/daily-monitoring"
              className="animate-fade-in-scale group rounded-xl border border-[#E5E8EC] bg-white/90 p-6 shadow-[0_1px_3px_rgba(16,24,40,0.06)] backdrop-blur-sm transition-all duration-300 hover:border-[#2563EB]/30 hover:bg-white hover:shadow-[0_4px_20px_rgba(37,99,235,0.12)]"
              style={{ animationDelay: '0.3s' }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563EB]/10 text-[#2563EB] transition-all duration-300 group-hover:bg-[#2563EB] group-hover:text-white group-hover:shadow-[0_2px_10px_rgba(37,99,235,0.3)]">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#1E293B]">Manage Care</h3>
                  <p className="text-sm text-[#64748B]">Daily monitoring & DMO</p>
                </div>
              </div>
            </Link>
          )}

          {showCms && (
            <Link
              to="/cms/users"
              className="animate-fade-in-scale group rounded-xl border border-[#E5E8EC] bg-white/90 p-6 shadow-[0_1px_3px_rgba(16,24,40,0.06)] backdrop-blur-sm transition-all duration-300 hover:border-[#14B8A6]/30 hover:bg-white hover:shadow-[0_4px_20px_rgba(20,184,166,0.12)]"
              style={{ animationDelay: '0.4s' }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#14B8A6]/10 text-[#14B8A6] transition-all duration-300 group-hover:bg-[#14B8A6] group-hover:text-white group-hover:shadow-[0_2px_10px_rgba(20,184,166,0.3)]">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#1E293B]">CMS</h3>
                  <p className="text-sm text-[#64748B]">Users, roles & permissions</p>
                </div>
              </div>
            </Link>
          )}

          <Link
            to="/settings"
            className="animate-fade-in-scale group rounded-xl border border-[#E5E8EC] bg-white/90 p-6 shadow-[0_1px_3px_rgba(16,24,40,0.06)] backdrop-blur-sm transition-all duration-300 hover:border-gray-300 hover:bg-white hover:shadow-[0_4px_20px_rgba(148,163,184,0.12)]"
            style={{ animationDelay: '0.5s' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-[#64748B] transition-all duration-300 group-hover:bg-gray-200 group-hover:text-[#1E293B]">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-[#1E293B]">Settings</h3>
                <p className="text-sm text-[#64748B]">{isSuperAdmin || isAdmin ? 'Application configuration' : 'Account settings'}</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}