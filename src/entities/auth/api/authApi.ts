/**
 * Auth API — RTK Query endpoints for authentication.
 */
import { api, API_URLS } from '@/shared/store/api';
import type { AuthUser, TwoFactorRequiredResponse } from '@/shared/types';

interface LoginRequest {
  name: string;
  password: string;
}

interface LoginSuccessResponse {
  token?: string;
  user?: AuthUser;
  data?: {
    token?: string;
    user?: AuthUser;
  };
}

/** Union response — either normal login or 2FA required. */
type LoginMutationResponse = LoginSuccessResponse | TwoFactorRequiredResponse;

interface ValidateTokenResponse {
  valid: boolean;
  user: AuthUser;
}

interface Verify2FALoginRequest {
  tempToken: string;
  token: string;
}

interface Verify2FALoginResponse {
  token: string;
  user: AuthUser;
}

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginMutationResponse, LoginRequest>({
      query: (credentials) => ({
        url: `${API_URLS.auth}/login`,
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
    }),
    validateToken: builder.query<ValidateTokenResponse, void>({
      query: () => `${API_URLS.auth}/validate`,
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: `${API_URLS.auth}/logout`,
        method: 'POST',
      }),
    }),
    // ── 2FA Login Verification ──
    verify2FALogin: builder.mutation<Verify2FALoginResponse, Verify2FALoginRequest>({
      query: (body) => ({
        url: `${API_URLS.auth}/verify-2fa-login`,
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useValidateTokenQuery,
  useLogoutMutation,
  useVerify2FALoginMutation,
} = authApi;