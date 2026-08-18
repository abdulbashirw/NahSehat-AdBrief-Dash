/**
 * Login page — authenticates user with JWT.
 * Rebuilt to full-screen responsive split design.
 *
 * Features:
 *  - Full screen 100vh / 100vw edge-to-edge responsive split layout
 *  - Animated futuristic 3D wave background & light particle glows
 *  - Official 3D-styled AdBrief "AB" Logo Mark & Brand Typography
 *  - Spacious form layout with generous input gaps and tap targets
 *  - User & Lock icons inside input fields with password visibility toggle
 *  - SSO integration option
 *  - Form validation via react-hook-form + zod
 *  - Toast notifications via sonner
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { toast } from 'sonner';
import { User, Lock, Eye, EyeOff, Loader2, Sparkles, ShieldCheck, ArrowLeft } from 'lucide-react';

import { useLoginMutation, useVerify2FALoginMutation } from '@/entities/auth/api/authApi';
import { setCredentials } from '@/entities/auth/model/authSlice';
import { useAppDispatch } from '@/shared/store';
import { useAuth } from '@/entities/auth';
import type { AuthUser } from '@/shared/types';

// ── Validation schema ──────────────────────────────────────────
const loginSchema = z.object({
  username: z
    .string()
    .min(1, 'Email or username is required')
    .min(3, 'Must be at least 3 characters')
    .max(50, 'Must be at most 50 characters'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters'),
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
          toast.info('Two-factor authentication required', {
            description: 'Please enter the 6-digit code from your authenticator app.',
          });
          return;
        }

        // After the 2FA guard above, TypeScript still sees the union type.
        // Cast to the success response shape to access token/user.
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
        toast.success('Login successful', {
          description: `Welcome back, ${authUser.fullName || authUser.username}!`,
        });
        navigate(from, { replace: true });
      } catch (err: unknown) {
        const message =
          (err as { data?: { message?: string } })?.data?.message ||
          'Invalid username or password. Please try again.';
        toast.error('Login failed', { description: message });
      }
    },
    [login, dispatch, navigate, from],
  );

  // ── 2FA verification submit ──
  const onVerify2FA = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (twoFactorCode.length !== 6) {
        toast.error('Invalid code', { description: 'Please enter the 6-digit code.' });
        return;
      }
      try {
        const result = await verify2FALogin({ tempToken, token: twoFactorCode }).unwrap();
        dispatch(setCredentials({ token: result.token, user: result.user }));
        toast.success('Login successful', {
          description: `Welcome back, ${result.user.fullName || result.user.username}!`,
        });
        navigate(from, { replace: true });
      } catch (err: unknown) {
        const message =
          (err as { data?: { message?: string } })?.data?.message ||
          'Invalid verification code. Please try again.';
        toast.error('Verification failed', { description: message });
      }
    },
    [verify2FALogin, tempToken, twoFactorCode, dispatch, navigate, from],
  );

  // ── Cancel 2FA, go back to login form ──
  const cancel2FA = useCallback(() => {
    setTwoFactorPending(false);
    setTempToken('');
    setTwoFactorCode('');
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white font-sans selection:bg-blue-200 overflow-x-hidden">
      {/* ── LEFT HERO PANEL (FULL HEIGHT) ───────────────────────── */}
      <div className="lg:w-[58%] xl:w-[60%] w-full relative bg-gradient-to-br from-[#010b1e] via-[#04265a] to-[#0a4db3] flex flex-col justify-between p-8 sm:p-12 md:p-16 lg:p-20 text-white min-h-[460px] lg:min-h-screen select-none overflow-hidden">
        {/* ── Animated Chart Data Visualization Background ── */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* ── Glow orbs ── */}
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#0052FF]/30 blur-[140px] animate-pulse-glow" />
          <div
            className="absolute top-1/3 right-[-10%] w-[600px] h-[600px] rounded-full bg-[#00D2FF]/20 blur-[150px] animate-pulse-glow"
            style={{ animationDelay: '2.5s' }}
          />
          <div
            className="absolute -bottom-40 left-1/4 w-[500px] h-[500px] rounded-full bg-[#00F0B5]/12 blur-[120px] animate-pulse-glow"
            style={{ animationDelay: '5s' }}
          />
          <div
            className="absolute top-2/3 left-[-5%] w-[350px] h-[350px] rounded-full bg-[#006AFF]/20 blur-[100px] animate-pulse-glow"
            style={{ animationDelay: '3.5s' }}
          />

          {/* ── Sparkle clusters ── */}
          <div className="absolute top-10 left-12 opacity-90 animate-float-particle">
            <div className="relative flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-cyan-300 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#00F0B5]" />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
            </div>
          </div>
          <div className="absolute top-20 right-16 opacity-70 animate-float-particle" style={{ animationDelay: '3s' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(0,210,255,0.6)]" />
          </div>
          <div className="absolute bottom-1/3 right-1/4 opacity-60 animate-float-particle" style={{ animationDelay: '4.5s' }}>
            <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(0,102,255,0.5)]" />
          </div>

          {/* ── Animated Chart Visualization SVG ── */}
          <svg
            className="absolute bottom-0 left-0 w-full h-[75%]"
            viewBox="0 0 1000 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMax slice"
          >
            <defs>
              {/* Primary line gradient */}
              <linearGradient id="chartLine1Grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0066FF" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#00D2FF" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#00F0B5" stopOpacity="0.7" />
              </linearGradient>
              {/* Secondary line gradient */}
              <linearGradient id="chartLine2Grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00A3FF" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#00E5D9" stopOpacity="0.5" />
              </linearGradient>
              {/* Area fill gradient */}
              <linearGradient id="chartAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0066FF" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
              </linearGradient>
              {/* Bar gradient */}
              <linearGradient id="chartBarGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#0052E6" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#00D2FF" stopOpacity="0.55" />
              </linearGradient>
              {/* Scan line gradient */}
              <linearGradient id="scanLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00D2FF" stopOpacity="0" />
                <stop offset="30%" stopColor="#00D2FF" stopOpacity="0.05" />
                <stop offset="50%" stopColor="#00D2FF" stopOpacity="0.12" />
                <stop offset="70%" stopColor="#00D2FF" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#00D2FF" stopOpacity="0" />
              </linearGradient>
              {/* Glow filter for data points */}
              <filter id="dataPointGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* ── Grid lines ── */}
            <g className="animate-grid-pulse">
              <line x1="30" y1="150" x2="970" y2="150" stroke="#00D2FF" strokeWidth="0.5" />
              <line x1="30" y1="250" x2="970" y2="250" stroke="#00D2FF" strokeWidth="0.5" />
              <line x1="30" y1="350" x2="970" y2="350" stroke="#00D2FF" strokeWidth="0.5" />
              <line x1="30" y1="450" x2="970" y2="450" stroke="#00D2FF" strokeWidth="0.5" />
              <line x1="30" y1="550" x2="970" y2="550" stroke="#00D2FF" strokeWidth="0.5" strokeDasharray="4 4" />
              <line x1="200" y1="100" x2="200" y2="550" stroke="#00D2FF" strokeWidth="0.5" />
              <line x1="400" y1="100" x2="400" y2="550" stroke="#00D2FF" strokeWidth="0.5" />
              <line x1="600" y1="100" x2="600" y2="550" stroke="#00D2FF" strokeWidth="0.5" />
              <line x1="800" y1="100" x2="800" y2="550" stroke="#00D2FF" strokeWidth="0.5" />
            </g>

            {/* ── Horizontal axis baseline ── */}
            <line x1="30" y1="550" x2="970" y2="550" stroke="#00D2FF" strokeWidth="1" opacity="0.2" />

            {/* ── Area fill under primary line ── */}
            <path
              d="M 30 490 C 70 470, 120 505, 170 480 C 220 455, 260 475, 310 435 C 360 395, 400 420, 450 370 C 500 320, 540 350, 590 300 C 640 250, 680 280, 730 235 C 780 190, 820 220, 870 180 C 920 140, 950 160, 970 150 L 970 550 L 30 550 Z"
              fill="url(#chartAreaGrad)"
              className="animate-area-breathe"
            />

            {/* ── Bar chart (right portion) ── */}
            <g>
              <rect x="560" y="550" width="28" height="0" rx="4" fill="url(#chartBarGrad)">
                <animate attributeName="height" from="0" to="180" dur="1.2s" begin="0.5s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
                <animate attributeName="y" from="550" to="370" dur="1.2s" begin="0.5s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
              </rect>
              <rect x="600" y="550" width="28" height="0" rx="4" fill="url(#chartBarGrad)">
                <animate attributeName="height" from="0" to="240" dur="1.2s" begin="0.65s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
                <animate attributeName="y" from="550" to="310" dur="1.2s" begin="0.65s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
              </rect>
              <rect x="640" y="550" width="28" height="0" rx="4" fill="url(#chartBarGrad)">
                <animate attributeName="height" from="0" to="150" dur="1.2s" begin="0.8s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
                <animate attributeName="y" from="550" to="400" dur="1.2s" begin="0.8s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
              </rect>
              <rect x="680" y="550" width="28" height="0" rx="4" fill="url(#chartBarGrad)">
                <animate attributeName="height" from="0" to="210" dur="1.2s" begin="0.95s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
                <animate attributeName="y" from="550" to="340" dur="1.2s" begin="0.95s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
              </rect>
              <rect x="720" y="550" width="28" height="0" rx="4" fill="url(#chartBarGrad)">
                <animate attributeName="height" from="0" to="170" dur="1.2s" begin="1.1s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
                <animate attributeName="y" from="550" to="380" dur="1.2s" begin="1.1s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
              </rect>
              <rect x="760" y="550" width="28" height="0" rx="4" fill="url(#chartBarGrad)">
                <animate attributeName="height" from="0" to="270" dur="1.2s" begin="1.25s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
                <animate attributeName="y" from="550" to="280" dur="1.2s" begin="1.25s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
              </rect>
              <rect x="800" y="550" width="28" height="0" rx="4" fill="url(#chartBarGrad)">
                <animate attributeName="height" from="0" to="130" dur="1.2s" begin="1.4s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
                <animate attributeName="y" from="550" to="420" dur="1.2s" begin="1.4s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
              </rect>
              <rect x="840" y="550" width="28" height="0" rx="4" fill="url(#chartBarGrad)">
                <animate attributeName="height" from="0" to="200" dur="1.2s" begin="1.55s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
                <animate attributeName="y" from="550" to="350" dur="1.2s" begin="1.55s" fill="freeze" calcMode="spline" keySplines="0.25 0.1 0.25 1" />
              </rect>
            </g>

            {/* ── Primary line chart (draws itself) ── */}
            <path
              d="M 30 490 C 70 470, 120 505, 170 480 C 220 455, 260 475, 310 435 C 360 395, 400 420, 450 370 C 500 320, 540 350, 590 300 C 640 250, 680 280, 730 235 C 780 190, 820 220, 870 180 C 920 140, 950 160, 970 150"
              stroke="url(#chartLine1Grad)"
              strokeWidth="2.5"
              fill="none"
              strokeDasharray="2000"
              className="animate-chart-line-draw"
              strokeLinecap="round"
            />

            {/* ── Secondary line chart (draws itself with delay) ── */}
            <path
              d="M 30 530 C 70 510, 120 520, 170 500 C 220 480, 260 490, 310 465 C 360 440, 400 460, 450 420 C 500 380, 540 400, 590 370 C 640 340, 680 360, 730 320 C 780 280, 820 300, 870 260 C 920 220, 950 240, 970 210"
              stroke="url(#chartLine2Grad)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="2000"
              className="animate-chart-line-draw"
              strokeLinecap="round"
              style={{ animationDelay: '0.8s' }}
            />

            {/* ── Data points on primary line (appear with delay) ── */}
            <g filter="url(#dataPointGlow)">
              <circle cx="170" cy="480" r="3.5" fill="#00D2FF" opacity="0">
                <animate attributeName="opacity" from="0" to="0.9" dur="0.4s" begin="1.5s" fill="freeze" />
              </circle>
              <circle cx="310" cy="435" r="3.5" fill="#00D2FF" opacity="0">
                <animate attributeName="opacity" from="0" to="0.9" dur="0.4s" begin="2s" fill="freeze" />
              </circle>
              <circle cx="450" cy="370" r="3.5" fill="#00D2FF" opacity="0">
                <animate attributeName="opacity" from="0" to="0.9" dur="0.4s" begin="2.5s" fill="freeze" />
              </circle>
              <circle cx="590" cy="300" r="3.5" fill="#00D2FF" opacity="0">
                <animate attributeName="opacity" from="0" to="0.9" dur="0.4s" begin="3s" fill="freeze" />
              </circle>
              <circle cx="730" cy="235" r="3.5" fill="#00D2FF" opacity="0">
                <animate attributeName="opacity" from="0" to="0.9" dur="0.4s" begin="3.5s" fill="freeze" />
              </circle>
              <circle cx="870" cy="180" r="3.5" fill="#00D2FF" opacity="0">
                <animate attributeName="opacity" from="0" to="0.9" dur="0.4s" begin="4s" fill="freeze" />
              </circle>
              <circle cx="970" cy="150" r="4" fill="#00F0B5" opacity="0">
                <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="4.5s" fill="freeze" />
              </circle>
            </g>

            {/* ── Data point pulse rings (continuously pulsing) ── */}
            <circle cx="450" cy="370" r="4" fill="none" stroke="#00D2FF" strokeWidth="1.5" opacity="0">
              <animate attributeName="opacity" from="0.6" to="0" dur="3s" begin="4s" repeatCount="indefinite" />
              <animate attributeName="r" from="4" to="18" dur="3s" begin="4s" repeatCount="indefinite" />
            </circle>
            <circle cx="730" cy="235" r="4" fill="none" stroke="#00D2FF" strokeWidth="1.5" opacity="0">
              <animate attributeName="opacity" from="0.6" to="0" dur="3s" begin="5s" repeatCount="indefinite" />
              <animate attributeName="r" from="4" to="18" dur="3s" begin="5s" repeatCount="indefinite" />
            </circle>
            <circle cx="970" cy="150" r="4" fill="none" stroke="#00F0B5" strokeWidth="1.5" opacity="0">
              <animate attributeName="opacity" from="0.6" to="0" dur="3s" begin="6s" repeatCount="indefinite" />
              <animate attributeName="r" from="4" to="18" dur="3s" begin="6s" repeatCount="indefinite" />
            </circle>

            {/* ── Scanning line (sweeps left to right) ── */}
            <rect x="-80" y="100" width="80" height="450" fill="url(#scanLineGrad)">
              <animate attributeName="x" from="-80" to="1050" dur="8s" repeatCount="indefinite" />
            </rect>
          </svg>

          {/* ── Floating data nodes ── */}
          <div className="absolute top-1/4 left-[15%] opacity-50 animate-float-node" style={{ animationDelay: '1s' }}>
            <div className="w-3 h-3 rounded-full bg-cyan-400/60 shadow-[0_0_12px_rgba(0,210,255,0.4)]" />
          </div>
          <div className="absolute top-[45%] left-[8%] opacity-40 animate-float-node" style={{ animationDelay: '2.5s' }}>
            <div className="w-2 h-2 rounded-full bg-blue-400/50 shadow-[0_0_8px_rgba(0,102,255,0.4)]" />
          </div>
          <div className="absolute bottom-1/3 right-[30%] opacity-45 animate-float-node" style={{ animationDelay: '4s' }}>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/50 shadow-[0_0_10px_rgba(0,240,181,0.4)]" />
          </div>
        </div>

        {/* Hero Content Area */}
        <div className="relative z-10 my-auto py-12 max-w-2xl">
          {/* Logo + Brand Title Horizontal Cluster */}
          <div className="flex items-center gap-6 sm:gap-8">
            <AdBriefLogoMark
              variant="light"
              className="w-48 sm:w-56 md:w-64 shrink-0 drop-shadow-[0_20px_50px_rgba(0,140,255,0.55)] transition-transform hover:scale-105 duration-300"
            />
            <div className="flex flex-col justify-center">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-none drop-shadow-[0_2px_20px_rgba(0,180,255,0.25)]">
                AdBrief
              </h1>
              <p className="text-xl sm:text-2xl font-medium text-cyan-200/90 tracking-wide mt-2">
                x <span className="font-bold text-white">NahSehat</span>
              </p>
            </div>
          </div>

          {/* Tagline */}
          <div className="mt-14 sm:mt-16 space-y-2">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight tracking-wide drop-shadow-[0_1px_10px_rgba(0,210,255,0.15)]">
              Complex Data.
            </h2>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white/95 leading-tight tracking-wide drop-shadow-[0_1px_10px_rgba(0,210,255,0.15)]">
              Clear Intelligence.
            </h2>
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL (FULL HEIGHT) ──────────────────────── */}
      <div className="lg:w-[42%] xl:w-[40%] w-full flex flex-col justify-center px-6 sm:px-12 md:px-16 lg:px-20 py-12 lg:py-16 bg-gradient-to-b from-white to-[#f8fafc] min-h-screen sm:min-h-0 lg:min-h-screen">
        <div className="w-full max-w-md mx-auto my-auto">
          {/* ── 2FA Verification View ── */}
          {twoFactorPending ? (
            <>
              {/* Header */}
              <div className="text-center mb-10">
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#00A3FF] flex items-center justify-center shadow-[0_8px_24px_rgba(0,102,255,0.3)]">
                  <ShieldCheck className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1727] tracking-tight">
                  Two-Factor Auth
                </h2>
                <p className="text-base font-medium text-[#64748B] mt-2.5">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              {/* 2FA Form */}
              <form onSubmit={onVerify2FA} className="space-y-5" noValidate>
                <div className="space-y-1.5">
                  <div className="relative group">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#0066FF] pointer-events-none transition-colors duration-200" />
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      autoFocus
                      className="w-full rounded-2xl border bg-[#f8fafc] py-4 pl-12 pr-4 text-base text-center text-2xl tracking-[0.5em] font-bold text-slate-800 placeholder:text-slate-300 placeholder:tracking-[0.3em] outline-none transition-all duration-200 focus:ring-4 hover:border-slate-300 hover:bg-white border-slate-200/80 focus:border-[#0066FF] focus:ring-[#0066FF]/10 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Verify Button */}
                <button
                  type="submit"
                  disabled={isLoading || twoFactorCode.length !== 6}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#0052E6] via-[#0066FF] to-[#00A3FF] hover:from-[#0044CC] hover:via-[#0055EE] hover:to-[#0090E0] text-white font-bold text-base shadow-[0_8px_30px_rgba(0,102,255,0.35)] hover:shadow-[0_12px_40px_rgba(0,102,255,0.45)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {isLoading ? 'Verifying...' : 'Verify'}
                </button>

                {/* Back to login */}
                <button
                  type="button"
                  onClick={cancel2FA}
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium text-[#64748B] hover:text-[#0066FF] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-10">
                <AdBriefLogoMark
                  className="w-28 sm:w-32 mx-auto mb-5 drop-shadow-[0_8px_24px_rgba(0,100,255,0.2)] transition-transform hover:scale-105 duration-200"
                />
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1727] tracking-tight">
                  Welcome Back
                </h2>
                <p className="text-base font-medium text-[#64748B] mt-2.5">
                  Sign in to your AdBrief account
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Email or Username */}
            <div className="space-y-1.5">
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#0066FF] pointer-events-none transition-colors duration-200" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Email or Username"
                  aria-invalid={errors.username ? 'true' : undefined}
                  aria-describedby={errors.username ? 'username-error' : undefined}
                  className={`w-full rounded-2xl border bg-[#f8fafc] py-4 pl-12 pr-4 text-base text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:ring-4 hover:border-slate-300 hover:bg-white ${errors.username
                    ? 'border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-400/20'
                    : 'border-slate-200/80 focus:border-[#0066FF] focus:ring-[#0066FF]/10 focus:bg-white'
                    }`}
                  {...register('username')}
                />
              </div>
              {errors.username && (
                <p id="username-error" className="text-xs text-red-500 font-medium pl-1" role="alert">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#0066FF] pointer-events-none transition-colors duration-200" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Password"
                  aria-invalid={errors.password ? 'true' : undefined}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className={`w-full rounded-2xl border bg-[#f8fafc] py-4 pl-12 pr-12 text-base text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:ring-4 hover:border-slate-300 hover:bg-white ${errors.password
                    ? 'border-red-400 bg-red-50/50 focus:border-red-400 focus:ring-red-400/20'
                    : 'border-slate-200/80 focus:border-[#0066FF] focus:ring-[#0066FF]/10 focus:bg-white'
                    }`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded-lg transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-xs text-red-500 font-medium pl-1" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#0052E6] via-[#0066FF] to-[#00A3FF] hover:from-[#0044CC] hover:via-[#0055EE] hover:to-[#0090E0] text-white font-bold text-base shadow-[0_8px_30px_rgba(0,102,255,0.35)] hover:shadow-[0_12px_40px_rgba(0,102,255,0.45)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>

          </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}