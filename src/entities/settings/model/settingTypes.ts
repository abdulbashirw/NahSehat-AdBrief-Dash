/**
 * Settings entity — types.
 */
export interface AppSettings {
  id: string;
  key: string;
  value: string;
  category: string;
  description?: string;
}

export interface UpdateSettingsRequest {
  id: string;
  value: string;
}

export interface ProfileUpdateRequest {
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

/** 2FA setup response from backend. */
export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeUrl: string;
  manualEntry: string;
}

/** 2FA verify request body. */
export interface TwoFactorVerifyRequest {
  token: string;
}

/** 2FA disable request body. */
export interface TwoFactorDisableRequest {
  currentPassword: string;
}

/** 2FA login verification request body. */
export interface TwoFactorLoginRequest {
  tempToken: string;
  token: string;
}