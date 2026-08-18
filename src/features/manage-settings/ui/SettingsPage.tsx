/**
 * Settings Page — role-aware tabs.
 *
 * SUPER_ADMIN: General, Application, Profile, Security
 * Other roles: Profile, Security only
 *
 * General & Application tabs call the settings API (SUPER_ADMIN only).
 * Profile & Security tabs call auth APIs (available to all authenticated users).
 * Security tab includes 2FA (TOTP RFC 6238) management.
 */
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  useGetSettingsQuery,
  useUpdateSettingMutation,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useSetup2FAMutation,
  useVerify2FAMutation,
  useDisable2FAMutation,
} from '@/entities/settings/api/settingApi';
import { useHasAnyRole } from '@/entities/auth/model/useRbac';
import { useAuth } from '@/entities/auth/model/useAuth';
import { useAppDispatch } from '@/shared/store';
import { updateUser } from '@/entities/auth/model/authSlice';
import PageHeader from '@/shared/components/common/PageHeader';
import LoadingSpinner from '@/shared/components/loading/LoadingSpinner';
import ApiError from '@/shared/components/error/ApiError';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Save, Settings as SettingsIcon, User, Shield, Monitor, ShieldCheck, QrCode, Loader2, Eye, EyeOff } from 'lucide-react';
import type { AuthUser } from '@/shared/types';

type TabKey = 'general' | 'application' | 'profile' | 'security';

export default function Settings() {
  const hasAnyRole = useHasAnyRole();
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const isSuperAdmin = hasAnyRole(['SUPER_ADMIN']);

  // Only fetch settings for SUPER_ADMIN — backend returns 403 for other roles
  const { data: settingsData, isLoading, isError, refetch } = useGetSettingsQuery(undefined, { skip: !isSuperAdmin });
  const [updateSetting] = useUpdateSettingMutation();
  const [updateProfile] = useUpdateProfileMutation();
  const [changePassword] = useChangePasswordMutation();
  const [setup2FA] = useSetup2FAMutation();
  const [verify2FA] = useVerify2FAMutation();
  const [disable2FA] = useDisable2FAMutation();

  const defaultTab: TabKey = isSuperAdmin ? 'general' : 'profile';
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  // ── Build key → UUID id map from fetched settings ──
  const keyToId = useMemo(() => {
    const map: Record<string, string> = {};
    if (settingsData) {
      for (const s of settingsData) {
        map[s.key] = s.id;
      }
    }
    return map;
  }, [settingsData]);

  // ── Build key → value map from fetched settings ──
  const settingsMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (settingsData) {
      for (const s of settingsData) {
        map[s.key] = s.value;
      }
    }
    return map;
  }, [settingsData]);

  const [general, setGeneral] = useState({
    appName: 'NahSehat Dashboard',
    language: 'id',
  });

  const [application, setApplication] = useState({
    maxLoginAttempts: '5',
    passwordMinLength: '8',
    enableExport: true,
  });

  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    phone: '',
  });

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // ── Per-tab saving states ──
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingApplication, setSavingApplication] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);

  // ── 2FA state ──
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [twoFactorSetupData, setTwoFactorSetupData] = useState<{ secret: string; qrCodeUrl: string; manualEntry: string } | null>(null);
  const [twoFactorVerifyCode, setTwoFactorVerifyCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [disable2FADialogOpen, setDisable2FADialogOpen] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState('');
  const [disable2FALoading, setDisable2FALoading] = useState(false);

  // ── Show/hide password toggles ──
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDisable2FAPassword, setShowDisable2FAPassword] = useState(false);

  // ── Load settings from API into form (General & Application) ──
  // DB keys: app.name, currency.locale, maxLoginAttempts,
  // passwordMinLength, enableExport
  // (sessionTimeout & enableNotifications removed from scope — system-managed)
  useEffect(() => {
    if (settingsMap && Object.keys(settingsMap).length > 0) {
      setGeneral({
        appName: settingsMap['app.name'] ?? 'NahSehat Dashboard',
        language: settingsMap['currency.locale'] ?? 'id-ID',
      });
      setApplication({
        maxLoginAttempts: settingsMap['maxLoginAttempts'] ?? '5',
        passwordMinLength: settingsMap['passwordMinLength'] ?? '8',
        enableExport: settingsMap['enableExport'] === 'true',
      });
    }
  }, [settingsMap]);

  // ── Pre-populate profile from auth user data ──
  useEffect(() => {
    if (user) {
      setProfile({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
      });
      setTwoFactorEnabled(user.twoFactorEnabled ?? false);
    }
  }, [user]);

  // ── Save handlers ──
  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await Promise.all([
        updateSetting({ id: keyToId['app.name'], value: general.appName }).unwrap(),
        updateSetting({ id: keyToId['currency.locale'], value: general.language }).unwrap(),
      ]);
      toast.success('General settings saved successfully');
    } catch {
      toast.error('Failed to save general settings');
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveApplication = async () => {
    setSavingApplication(true);
    try {
      await Promise.all([
        updateSetting({ id: keyToId['maxLoginAttempts'], value: application.maxLoginAttempts }).unwrap(),
        updateSetting({ id: keyToId['passwordMinLength'], value: application.passwordMinLength }).unwrap(),
        updateSetting({ id: keyToId['enableExport'], value: String(application.enableExport) }).unwrap(),
      ]);
      toast.success('Application settings saved successfully');
    } catch {
      toast.error('Failed to save application settings');
    } finally {
      setSavingApplication(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const result = await updateProfile({
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
      }).unwrap();
      // Update Redux state with new user data
      if (result.user) {
        dispatch(updateUser(result.user as AuthUser));
      }
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    // ── Validation ──
    if (security.newPassword !== security.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (security.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (security.newPassword === security.currentPassword) {
      toast.error('New password must be different from current password');
      return;
    }
    if (!/[A-Z]/.test(security.newPassword) || !/[a-z]/.test(security.newPassword) || !/\d/.test(security.newPassword)) {
      toast.error('Password must contain uppercase, lowercase, and a number');
      return;
    }
    setSavingSecurity(true);
    try {
      await changePassword({
        currentPassword: security.currentPassword,
        newPassword: security.newPassword,
      }).unwrap();
      setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed successfully');
    } catch (err: unknown) {
      const message = (err as { data?: { message?: string } })?.data?.message || 'Failed to change password';
      toast.error(message);
    } finally {
      setSavingSecurity(false);
    }
  };

  // ── 2FA: Start setup ──
  const handleSetup2FA = async () => {
    setTwoFactorLoading(true);
    try {
      const result = await setup2FA().unwrap();
      setTwoFactorSetupData(result);
      setTwoFactorDialogOpen(true);
    } catch (err: unknown) {
      const message = (err as { data?: { message?: string } })?.data?.message || 'Failed to setup 2FA';
      toast.error(message);
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // ── 2FA: Verify code and enable ──
  const handleVerify2FA = async () => {
    if (twoFactorVerifyCode.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    setTwoFactorLoading(true);
    try {
      await verify2FA({ token: twoFactorVerifyCode }).unwrap();
      setTwoFactorEnabled(true);
      setTwoFactorDialogOpen(false);
      setTwoFactorSetupData(null);
      setTwoFactorVerifyCode('');
      toast.success('Two-factor authentication enabled successfully');
    } catch (err: unknown) {
      const message = (err as { data?: { message?: string } })?.data?.message || 'Invalid verification code';
      toast.error(message);
    } finally {
      setTwoFactorLoading(false);
    }
  };

  // ── 2FA: Disable ──
  const handleDisable2FA = async () => {
    if (!disable2FAPassword) {
      toast.error('Please enter your current password');
      return;
    }
    setDisable2FALoading(true);
    try {
      await disable2FA({ currentPassword: disable2FAPassword }).unwrap();
      setTwoFactorEnabled(false);
      setDisable2FADialogOpen(false);
      setDisable2FAPassword('');
      toast.success('Two-factor authentication disabled');
    } catch (err: unknown) {
      const message = (err as { data?: { message?: string } })?.data?.message || 'Failed to disable 2FA';
      toast.error(message);
    } finally {
      setDisable2FALoading(false);
    }
  };

  // Show loading only for SUPER_ADMIN on admin tabs
  if (isSuperAdmin && isLoading) return <LoadingSpinner message="Loading settings..." />;

  const settingsError = isSuperAdmin && isError;

  // Role-based tabs
  const tabs: { key: TabKey; label: string; icon: typeof SettingsIcon }[] = [
    ...(isSuperAdmin
      ? [
          { key: 'general' as const, label: 'General', icon: SettingsIcon },
          { key: 'application' as const, label: 'Application', icon: Monitor },
        ]
      : []),
    { key: 'profile' as const, label: 'Profile', icon: User },
    { key: 'security' as const, label: 'Security', icon: Shield },
  ];

  return (
    <div className="p-6">
      <PageHeader title="Settings" description={isSuperAdmin ? 'Manage application and account settings' : 'Manage your account settings'} />

      <div className="mt-6 flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-56 shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${activeTab === tab.key
                    ? 'bg-[#0066FF] text-white'
                    : 'text-[#6B7280] hover:bg-[#F4F6F8] hover:text-[#1F2A37]'
                  }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* ── General Settings (SUPER_ADMIN only) ── */}
          {activeTab === 'general' && settingsError && <ApiError onRetry={refetch} />}
          {activeTab === 'general' && !settingsError && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-[#1F2A37]">General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 items-center gap-4">
                  <label className="text-sm font-medium text-[#1F2A37]">Application Name</label>
                  <Input
                    value={general.appName}
                    onChange={(e) => setGeneral((g) => ({ ...g, appName: e.target.value }))}
                    className="col-span-2"
                  />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <label className="text-sm font-medium text-[#1F2A37]">Language</label>
                  <Select value={general.language} onValueChange={(v) => setGeneral((g) => ({ ...g, language: v }))}>
                    <SelectTrigger className="col-span-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id">Bahasa Indonesia</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveGeneral} disabled={savingGeneral} className="bg-[#0066FF] hover:bg-[#0052E6]">
                    <Save className="mr-2 h-4 w-4" />
                    {savingGeneral ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Application Settings (SUPER_ADMIN only) ── */}
          {activeTab === 'application' && settingsError && <ApiError onRetry={refetch} />}
          {activeTab === 'application' && !settingsError && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-[#1F2A37]">Application Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 items-center gap-4">
                  <label className="text-sm font-medium text-[#1F2A37]">Max Login Attempts</label>
                  <Input
                    type="number"
                    value={application.maxLoginAttempts}
                    onChange={(e) => setApplication((a) => ({ ...a, maxLoginAttempts: e.target.value }))}
                    className="col-span-2"
                  />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <label className="text-sm font-medium text-[#1F2A37]">Min Password Length</label>
                  <Input
                    type="number"
                    value={application.passwordMinLength}
                    onChange={(e) => setApplication((a) => ({ ...a, passwordMinLength: e.target.value }))}
                    className="col-span-2"
                  />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <label className="text-sm font-medium text-[#1F2A37]">Enable Data Export</label>
                  <div className="col-span-2 flex items-center gap-3">
                    <Switch
                      checked={application.enableExport}
                      onCheckedChange={(checked) => setApplication((a) => ({ ...a, enableExport: checked }))}
                      className="data-[state=checked]:bg-[#0066FF]"
                    />
                    <span className="text-sm text-[#6B7280]">Allow users to export data (CSV, PDF)</span>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveApplication} disabled={savingApplication} className="bg-[#0066FF] hover:bg-[#0052E6]">
                    <Save className="mr-2 h-4 w-4" />
                    {savingApplication ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Profile Settings (All roles) ── */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-[#1F2A37]">Profile Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 items-center gap-4">
                  <label className="text-sm font-medium text-[#1F2A37]">Full Name</label>
                  <Input
                    value={profile.fullName}
                    onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
                    placeholder="Enter your full name"
                    className="col-span-2"
                  />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <label className="text-sm font-medium text-[#1F2A37]">Email</label>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                    placeholder="Enter your email"
                    className="col-span-2"
                  />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <label className="text-sm font-medium text-[#1F2A37]">Phone</label>
                  <Input
                    value={profile.phone}
                    onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Enter your phone number"
                    className="col-span-2"
                  />
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSaveProfile} disabled={savingProfile} className="bg-[#0066FF] hover:bg-[#0052E6]">
                    <Save className="mr-2 h-4 w-4" />
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Security Settings (All roles) ── */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Change Password Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-[#1F2A37]">Change Password</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-sm font-medium text-[#1F2A37]">Current Password</label>
                    <div className="col-span-2 relative">
                      <Input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={security.currentPassword}
                        onChange={(e) => setSecurity((s) => ({ ...s, currentPassword: e.target.value }))}
                        placeholder="Enter current password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1F2A37]"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-sm font-medium text-[#1F2A37]">New Password</label>
                    <div className="col-span-2 relative">
                      <Input
                        type={showNewPassword ? 'text' : 'password'}
                        value={security.newPassword}
                        onChange={(e) => setSecurity((s) => ({ ...s, newPassword: e.target.value }))}
                        placeholder="Enter new password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1F2A37]"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label className="text-sm font-medium text-[#1F2A37]">Confirm Password</label>
                    <div className="col-span-2 relative">
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={security.confirmPassword}
                        onChange={(e) => setSecurity((s) => ({ ...s, confirmPassword: e.target.value }))}
                        placeholder="Confirm new password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1F2A37]"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#F4F6F8] px-4 py-3 text-xs text-[#6B7280]">
                    Password must be at least 8 characters and contain uppercase, lowercase, and a number.
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleChangePassword} disabled={savingSecurity} className="bg-[#0066FF] hover:bg-[#0052E6]">
                      <Save className="mr-2 h-4 w-4" />
                      {savingSecurity ? 'Saving...' : 'Update Password'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Two-Factor Authentication Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-[#1F2A37] flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-[#0066FF]" />
                    Two-Factor Authentication (2FA)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${twoFactorEnabled ? 'bg-[#0066FF]/10' : 'bg-gray-100'}`}>
                        <ShieldCheck className={`h-5 w-5 ${twoFactorEnabled ? 'text-[#0066FF]' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1F2A37]">
                          {twoFactorEnabled ? '2FA is Enabled' : '2FA is Disabled'}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {twoFactorEnabled
                            ? 'Your account is protected with TOTP authenticator'
                            : 'Protect your account with an authenticator app (Google Authenticator, Authy, etc.)'}
                        </p>
                      </div>
                    </div>
                    {twoFactorEnabled ? (
                      <Button
                        variant="outline"
                        onClick={() => setDisable2FADialogOpen(true)}
                        className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        Disable
                      </Button>
                    ) : (
                      <Button
                        onClick={handleSetup2FA}
                        disabled={twoFactorLoading}
                        className="bg-[#0066FF] hover:bg-[#0052E6]"
                      >
                        {twoFactorLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <QrCode className="mr-2 h-4 w-4" />
                        )}
                        Enable 2FA
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ── 2FA Setup Dialog ── */}
      <Dialog open={twoFactorDialogOpen} onOpenChange={setTwoFactorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#0066FF]" />
              Set Up Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator), then enter the 6-digit verification code.
            </DialogDescription>
          </DialogHeader>

          {twoFactorSetupData && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <img
                  src={twoFactorSetupData.qrCodeUrl}
                  alt="2FA QR Code"
                  className="rounded-lg border border-[#E5E7EB] p-2"
                  style={{ width: 200, height: 200 }}
                />
              </div>

              {/* Manual entry key */}
              <div className="rounded-lg bg-[#F4F6F8] px-4 py-3">
                <p className="text-xs font-medium text-[#6B7280] mb-1">Can't scan? Enter this key manually:</p>
                <p className="font-mono text-sm text-[#1F2A37] break-all select-all">
                  {twoFactorSetupData.manualEntry}
                </p>
              </div>

              {/* Verification code input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1F2A37]">Verification Code</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFactorVerifyCode}
                  onChange={(e) => setTwoFactorVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit code"
                  className="text-center text-lg tracking-[0.3em] font-bold"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTwoFactorDialogOpen(false);
                setTwoFactorSetupData(null);
                setTwoFactorVerifyCode('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerify2FA}
              disabled={twoFactorLoading || twoFactorVerifyCode.length !== 6}
              className="bg-[#0066FF] hover:bg-[#0052E6]"
            >
              {twoFactorLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {twoFactorLoading ? 'Verifying...' : 'Verify & Enable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Disable 2FA Dialog ── */}
      <Dialog open={disable2FADialogOpen} onOpenChange={setDisable2FADialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-500" />
              Disable Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Enter your current password to disable 2FA. This will make your account less secure.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#1F2A37]">Current Password</label>
            <div className="relative">
              <Input
                type={showDisable2FAPassword ? 'text' : 'password'}
                value={disable2FAPassword}
                onChange={(e) => setDisable2FAPassword(e.target.value)}
                placeholder="Enter your current password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowDisable2FAPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1F2A37]"
              >
                {showDisable2FAPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDisable2FADialogOpen(false);
                setDisable2FAPassword('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDisable2FA}
              disabled={disable2FALoading || !disable2FAPassword}
              className="bg-red-600 hover:bg-red-700"
            >
              {disable2FALoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {disable2FALoading ? 'Disabling...' : 'Disable 2FA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}