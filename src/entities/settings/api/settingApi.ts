/**
 * Settings API service — RTK Query endpoints for application settings,
 * profile updates, password changes, and 2FA management.
 */
import { api, API_URLS } from '@/shared/store/api';
import type {
  AppSettings,
  UpdateSettingsRequest,
  ProfileUpdateRequest,
  PasswordChangeRequest,
  TwoFactorSetupResponse,
  TwoFactorVerifyRequest,
  TwoFactorDisableRequest,
} from '../model/settingTypes';
import type { AuthUser } from '@/shared/types';

export const settingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query<AppSettings[], { category?: string } | void>({
      query: (params) => ({
        url: `${API_URLS.cms}/settings`,
        params: params ?? undefined,
      }),
      providesTags: ['Setting'],
    }),
    getPublicSettings: builder.query<{ enableExport: boolean }, void>({
      query: () => ({
        url: `${API_URLS.cms}/settings/public`,
      }),
      providesTags: ['Setting'],
    }),
    updateSetting: builder.mutation<AppSettings, UpdateSettingsRequest>({
      query: ({ id, value }) => ({
        url: `${API_URLS.cms}/settings/${id}`,
        method: 'PUT',
        body: { value },
      }),
      invalidatesTags: ['Setting'],
    }),

    // Also refetch public settings when any setting changes
    // (handled by shared 'Setting' tag)
    updateProfile: builder.mutation<{ user: AuthUser }, ProfileUpdateRequest>({
      query: (body) => ({
        url: `${API_URLS.auth}/profile`,
        method: 'PUT',
        body,
      }),
    }),
    changePassword: builder.mutation<void, PasswordChangeRequest>({
      query: (body) => ({
        url: `${API_URLS.auth}/change-password`,
        method: 'POST',
        body,
      }),
    }),
    // ── Two-Factor Authentication (TOTP RFC 6238) ──
    setup2FA: builder.mutation<TwoFactorSetupResponse, void>({
      query: () => ({
        url: `${API_URLS.auth}/2fa/setup`,
        method: 'POST',
      }),
    }),
    verify2FA: builder.mutation<{ enabled: boolean }, TwoFactorVerifyRequest>({
      query: (body) => ({
        url: `${API_URLS.auth}/2fa/verify`,
        method: 'POST',
        body,
      }),
    }),
    disable2FA: builder.mutation<{ enabled: boolean }, TwoFactorDisableRequest>({
      query: (body) => ({
        url: `${API_URLS.auth}/2fa/disable`,
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useGetSettingsQuery,
  useGetPublicSettingsQuery,
  useUpdateSettingMutation,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useSetup2FAMutation,
  useVerify2FAMutation,
  useDisable2FAMutation,
} = settingApi;