/**
 * Login page — authenticates user with JWT.
 * Redesigned to executive minimalist healthcare theme:
 *
 * Features:
 *  - Full screen responsive split design
 *  - Executive deep navy gradient hero with glowing organic ambient lighting
 *  - Floating interactive healthcare metrics glass cards with framer-motion
 *  - Elegant curved animated data waves
 *  - Refined minimalist floating login card with sleek inputs and micro-interactions
 *  - Seamless 2FA verification flow
 *  - Form validation via react-hook-form + zod
 *  - Toast notifications via sonner
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  ArrowLeft,
  Activity,
  TrendingUp,
  CircleDollarSign,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

import { useLoginMutation, useVerify2FALoginMutation } from '@/entities/auth/api/authApi';
import { setCredentials } from '@/entities/auth/model/authSlice';
import { useAppDispatch } from '@/shared/store';
import { useAuth } from '@/entities/auth';
import type { AuthUser } from '@/shared/types';

// ── Validation schema ──────────────────────────────────────────
const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Email atau username wajib diisi')
    .min(3, 'Minimal 3 karakter')
    .max(50, 'Maksimal 50 karakter'),
  password: z
    .string()
    .min(1, 'Password wajib diisi')
    .min(6, 'Password minimal 6 karakter')
    .max(128, 'Password maksimal 128 karakter'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ── AdBrief Logo Mark (uses official SVG asset) ─────────────────
export function AdBriefLogoMark({
  className = 'w-16 h-16',
  variant = 'dark',
}: {
  className?: string;
  variant?: 'light' | 'dark';
}) {
  return (
    <img
      src={variant === 'light' ? '/logo-mark-light.svg' : '/logo-mark.svg'}
      alt="AdBrief Logo"
      className={className}
      draggable={false}
    />
  );
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const [login, { isLoading: isLoginLoading }] = useLoginMutation();
  const [verify2FALogin, { isLoading: is2FALoading }] = useVerify2FALoginMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  const isLoading = isLoginLoading || is2FALoading;

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // Redirect authenticated users away from login
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user, navigate, from]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  // Auto-focus username field on mount
  useEffect(() => {
    setFocus('username');
  }, [setFocus]);

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      try {
        const result = await login({ name: data.username, password: data.password }).unwrap();

        // Check if 2FA is required
        if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
          setTempToken(result.tempToken);
          setTwoFactorPending(true);
          toast.info('Verifikasi Dua Faktor Diperlukan', {
            description: 'Masukkan 6 digit kode dari aplikasi autentikator Anda.',
          });
          return;
        }

        const successResult = result as { data?: { token?: string; user?: AuthUser }; token?: string; user?: AuthUser };
        const token = successResult.data?.token || successResult.token || '';
        const authUser: AuthUser = successResult.data?.user ?? successResult.user ?? {
          id: '',
          username: data.username,
          email: '',
          fullName: data.username,
          role: 'ADMIN' as const,
          permissions: [],
          payorIds: [],
          isActive: true,
        };

        dispatch(setCredentials({ token, user: authUser }));
        toast.success('Login Berhasil', {
          description: `Selamat datang kembali, ${authUser.fullName || authUser.username}!`,
        });
        navigate(from, { replace: true });
      } catch (err: unknown) {
        const message =
          (err as { data?: { message?: string } })?.data?.message ||
          'Username atau password salah. Silakan coba kembali.';
        toast.error('Login Gagal', { description: message });
      }
    },
    [login, dispatch, navigate, from],
  );

  // ── 2FA verification submit ──
  const onVerify2FA = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (twoFactorCode.length !== 6) {
        toast.error('Kode Tidak Valid', { description: 'Masukkan 6 digit kode autentikasi.' });
        return;
      }
      try {
        const result = await verify2FALogin({ tempToken, token: twoFactorCode }).unwrap();
        dispatch(setCredentials({ token: result.token, user: result.user }));
        toast.success('Verifikasi Berhasil', {
          description: `Selamat datang kembali, ${result.user.fullName || result.user.username}!`,
        });
        navigate(from, { replace: true });
      } catch (err: unknown) {
        const message =
          (err as { data?: { message?: string } })?.data?.message ||
          'Kode verifikasi tidak sesuai atau sudah kedaluwarsa.';
        toast.error('Verifikasi Gagal', { description: message });
      }
    },
    [verify2FALogin, tempToken, twoFactorCode, dispatch, navigate, from],
  );

  const cancel2FA = useCallback(() => {
    setTwoFactorPending(false);
    setTempToken('');
    setTwoFactorCode('');
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F8FAFC] font-sans selection:bg-blue-200 overflow-x-hidden">
      {/* ── LEFT HERO PANEL (EXECUTIVE HEALTHCARE VISUALS) ────────── */}
      <div className="lg:w-[56%] xl:w-[58%] w-full relative bg-gradient-to-br from-[#0B1528] via-[#0F264C] to-[#1E3A6E] flex flex-col justify-between p-8 sm:p-12 md:p-14 lg:p-16 text-white min-h-[520px] lg:min-h-screen select-none overflow-hidden">
        {/* ── Ambient Background Lighting & Grid Texture ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          {/* Smooth breathing glowing ambient orbs */}
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.25, 0.4, 0.25],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-32 -left-32 w-[550px] h-[550px] rounded-full bg-[#2563EB]/35 blur-[130px]"
          />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.18, 0.32, 0.18],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            className="absolute top-1/3 -right-20 w-[500px] h-[500px] rounded-full bg-[#059669]/20 blur-[140px]"
          />
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.15, 0.28, 0.15],
            }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
            className="absolute -bottom-24 left-1/4 w-[450px] h-[450px] rounded-full bg-[#4F46E5]/25 blur-[120px]"
          />

          {/* Animated utilization chart keeps the analytics context visible behind the metrics. */}
          <svg
            className="absolute bottom-0 left-0 w-full h-[68%] opacity-55"
            viewBox="0 0 1000 500"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="chartLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.35" />
                <stop offset="52%" stopColor="#67E8F9" stopOpacity="1" />
                <stop offset="100%" stopColor="#6EE7B7" stopOpacity="0.75" />
              </linearGradient>
              <linearGradient id="chartSecondaryGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#818CF8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.55" />
              </linearGradient>
              <linearGradient id="chartAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
              </linearGradient>
              <filter id="chartGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Subtle chart grid and baseline */}
            <g stroke="#93C5FD" strokeOpacity="0.13" strokeWidth="1">
              <path d="M0 120H1000M0 220H1000M0 320H1000M0 420H1000" />
              <path d="M100 70V500M280 70V500M460 70V500M640 70V500M820 70V500" />
            </g>
            <path d="M0 455H1000" stroke="#BFDBFE" strokeOpacity="0.25" />

            {/* Filled trend area */}
            <path
              d="M0,390 C90,360 125,400 205,350 C285,300 330,350 405,305 C490,250 545,315 620,245 C700,170 755,245 820,190 C885,135 930,175 1000,120 L1000,455 L0,455 Z"
              fill="url(#chartAreaGrad)"
            />

            {/* Primary animated utilization series */}
            <motion.path
              d="M0,390 C90,360 125,400 205,350 C285,300 330,350 405,305 C490,250 545,315 620,245 C700,170 755,245 820,190 C885,135 930,175 1000,120"
              stroke="url(#chartLineGrad)"
              strokeWidth="3"
              strokeLinecap="round"
              filter="url(#chartGlow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 2.4, ease: 'easeOut' }}
            />

            {/* Secondary comparison series */}
            <motion.path
              d="M0,425 C100,405 155,430 245,390 C330,350 390,405 480,365 C575,325 635,350 710,300 C800,240 855,305 930,255 C960,235 980,245 1000,225"
              stroke="url(#chartSecondaryGrad)"
              strokeWidth="2"
              strokeDasharray="7 9"
              strokeLinecap="round"
            />

            {/* Moving live point and its guide line */}
            <motion.path
              d="M620 90V455"
              stroke="#67E8F9"
              strokeOpacity="0.2"
              strokeDasharray="4 8"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.circle
              cx="620"
              cy="245"
              r="5"
              fill="#67E8F9"
              filter="url(#chartGlow)"
              animate={{
                cx: [620, 700, 820, 930],
                cy: [245, 170, 190, 175],
                opacity: [0.4, 1, 0.75, 0.4],
              }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.circle
              cx="620"
              cy="245"
              r="12"
              stroke="#67E8F9"
              strokeWidth="1"
              animate={{ r: [8, 18, 8], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
            />
          </svg>
        </div>

        {/* ── Top Brand Identifier ── */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-md shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10B981]" />
            </span>
            <span className="text-xs font-semibold text-slate-200 tracking-wide">
              AdMedika Enterprise Analytics
            </span>
          </div>
        </div>

        {/* ── Hero Center Content ── */}
        <div className="relative z-10 my-auto py-8 max-w-xl">
          {/* Logo Cluster */}
          <div className="flex items-center gap-5 sm:gap-6">
            <AdBriefLogoMark
              variant="light"
              className="w-32 sm:w-40 md:w-44 shrink-0 drop-shadow-[0_12px_32px_rgba(37,99,235,0.45)] transition-transform hover:scale-105 duration-300"
            />
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2.5">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-none">
                  AdBrief
                </h1>
                <span className="rounded-md bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-xs font-bold text-emerald-300">
                  v2.0
                </span>
              </div>
              <p className="text-base sm:text-lg font-medium text-slate-300 mt-1.5 flex items-center gap-1.5">
                powered by <span className="font-bold text-white tracking-wide">NahSehat</span>
              </p>
            </div>
          </div>

          {/* Tagline */}
          <div className="mt-10 sm:mt-12 space-y-1.5">
            <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-white leading-tight tracking-tight">
              Complex Data.
            </h2>
            <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-black bg-gradient-to-r from-blue-200 via-sky-100 to-emerald-200 bg-clip-text text-transparent leading-tight tracking-tight">
              Clear Intelligence.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-300/90 leading-relaxed font-normal max-w-lg">
              Solusi terpadu monitoring utilisasi benefit kesehatan, analitik klaim real-time, dan manajemen risiko presisi enterprise AdMedika.
            </p>
          </div>

          {/* ── Floating Executive Glass Metric Cards ── */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">

            {/* Card 1: Indemnity utilization */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
              className="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md shadow-lg transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-300/30 text-amber-200">
                    <CircleDollarSign className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-200 truncate">Indemnity</span>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-amber-200 bg-amber-500/20 border border-amber-300/30 rounded-full px-2 py-0.5">
                  Terkendali
                </span>
              </div>
              <div className="mt-3">
                <div className="text-lg font-extrabold text-white tracking-tight tabular-nums">87.4%</div>
                <p className="text-[10px] text-slate-300 mt-0.5">Utilisasi benefit indemnity</p>
              </div>
            </motion.div>

            {/* Card 2: SLA & Claims */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
              className="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md shadow-lg transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                    <Activity className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-200">Daily Monitoring</span>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/20 rounded-full px-2 py-0.5">
                  <CheckCircle2 className="h-3 w-3" />
                  Live SLA
                </span>
              </div>
              <div className="mt-3">
                <div className="text-lg font-extrabold text-white tracking-tight tabular-nums">
                  99.85%
                </div>
                <p className="text-[10px] text-slate-300 mt-0.5">Akurasi audit klaim otomatis</p>
              </div>
            </motion.div>

            {/* Card 3: Risk Scoring & Telemetry */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
              className="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md shadow-lg transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-200">AdScore Engine</span>
                </div>
                <span className="text-[10px] font-bold text-sky-200 bg-blue-500/20 border border-blue-400/30 rounded-full px-2 py-0.5">
                  Predictive
                </span>
              </div>
              <div className="mt-3">
                <div className="text-lg font-extrabold text-white tracking-tight tabular-nums">
                  24/7 Telemetri
                </div>
                <p className="text-[10px] text-slate-300 mt-0.5">Sinkronisasi real-time NahSehat</p>
              </div>
            </motion.div>

          </div>
        </div>

        {/* ── Left Footer ── */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-4 mt-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Enterprise Security & Data Privacy Protected</span>
          </div>
          <span className="hidden sm:inline">AdMedika Part of Fullerton Health</span>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL (CLEAN MINIMALIST CARD) ─────────────── */}
      <div className="lg:w-[44%] xl:w-[42%] w-full flex flex-col justify-center items-center px-6 sm:px-12 md:px-16 lg:px-16 py-12 lg:py-16 bg-gradient-to-b from-[#F8FAFC] via-[#FFFFFF] to-[#F1F5F9] min-h-screen sm:min-h-0 lg:min-h-screen relative">
        {/* Subtle decorative background light */}
        <div className="absolute top-12 right-12 w-72 h-72 rounded-full bg-blue-100/50 blur-[90px] pointer-events-none" />
        <div className="absolute bottom-12 left-12 w-72 h-72 rounded-full bg-emerald-100/40 blur-[90px] pointer-events-none" />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Executive Floating Form Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="rounded-3xl border border-slate-200/90 bg-white/95 p-7 sm:p-9 shadow-[0_20px_50px_-15px_rgba(15,39,74,0.07)] backdrop-blur-xl"
          >
            <AnimatePresence mode="wait">
              {/* ── 2FA Verification View ── */}
              {twoFactorPending ? (
                <motion.div
                  key="2fa-view"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Header */}
                  <div className="text-center mb-8">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB] shadow-xs">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
                      Autentikasi 2FA
                    </h2>
                    <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">
                      Masukkan 6 digit kode verifikasi dari aplikasi authenticator Anda
                    </p>
                  </div>

                  {/* 2FA Form */}
                  <form onSubmit={onVerify2FA} className="space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <div className="relative group">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="000000"
                          autoFocus
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3.5 px-4 text-center text-2xl tracking-[0.5em] font-extrabold text-slate-800 placeholder:text-slate-300 placeholder:tracking-[0.3em] outline-none transition-all duration-200 hover:border-slate-300 hover:bg-white focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Verify Button */}
                    <button
                      type="submit"
                      disabled={isLoading || twoFactorCode.length !== 6}
                      className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#1E3A6E] via-[#2563EB] to-[#1D4ED8] hover:from-[#172E57] hover:via-[#1D4ED8] hover:to-[#1E40AF] text-white font-bold text-sm shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                    >
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{isLoading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}</span>
                    </button>

                    {/* Back to login */}
                    <button
                      type="button"
                      onClick={cancel2FA}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#2563EB] transition-colors cursor-pointer py-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Kembali ke halaman login</span>
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="login-form-view"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                >
                  {/* Header */}
                  <div className="text-center mb-8">
                    <AdBriefLogoMark
                      variant="dark"
                      className="w-24 sm:w-28 mx-auto mb-4 drop-shadow-[0_4px_16px_rgba(15,23,42,0.08)] transition-transform hover:scale-105 duration-200"
                    />
                    <h2 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
                      Selamat Datang
                    </h2>
                    <p className="text-xs font-medium text-slate-500 mt-1.5">
                      Masuk ke sistem analitik benefit AdBrief
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    {/* Username Field */}
                    <div className="space-y-1.5">
                      <label htmlFor="username" className="block text-xs font-bold text-[#334155]">
                        Username
                      </label>
                      <div className="relative group">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#2563EB] pointer-events-none transition-colors duration-200" />
                        <input
                          id="username"
                          type="text"
                          autoComplete="username"
                          placeholder="Masukkan username"
                          aria-invalid={errors.username ? 'true' : undefined}
                          aria-describedby={errors.username ? 'username-error' : undefined}
                          className={`w-full rounded-xl border bg-slate-50/70 py-3 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 hover:border-slate-300 hover:bg-white ${errors.username
                            ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                            : 'border-slate-200 focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 focus:bg-white'
                            }`}
                          {...register('username')}
                        />
                      </div>
                      {errors.username && (
                        <p id="username-error" className="text-[11px] text-red-500 font-medium pl-1" role="alert">
                          {errors.username.message}
                        </p>
                      )}
                    </div>

                    {/* Password Field */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="password" className="block text-xs font-bold text-[#334155]">
                          Kata Sandi
                        </label>
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#2563EB] pointer-events-none transition-colors duration-200" />
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="Masukkan kata sandi"
                          aria-invalid={errors.password ? 'true' : undefined}
                          aria-describedby={errors.password ? 'password-error' : undefined}
                          className={`w-full rounded-xl border bg-slate-50/70 py-3 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 hover:border-slate-300 hover:bg-white ${errors.password
                            ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                            : 'border-slate-200 focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10 focus:bg-white'
                            }`}
                          {...register('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-md transition-colors"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          tabIndex={0}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p id="password-error" className="text-[11px] text-red-500 font-medium pl-1" role="alert">
                          {errors.password.message}
                        </p>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#1E3A6E] via-[#2563EB] to-[#1D4ED8] hover:from-[#172E57] hover:via-[#1D4ED8] hover:to-[#1E40AF] text-white font-bold text-sm shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] hover:shadow-[0_14px_30px_-5px_rgba(37,99,235,0.5)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Memproses Autentikasi...</span>
                        </>
                      ) : (
                        <>
                          <span>Masuk ke Dashboard</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bottom Security Assurance */}
          <div className="mt-8 text-center">
            <p className="text-[11px] text-slate-400 mt-1">
              © {new Date().getFullYear()} AdMedika NahSehat Healthcare System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}