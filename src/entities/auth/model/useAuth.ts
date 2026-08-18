/**
 * Auth hooks — typed selectors and dispatchers for auth state.
 *
 * The logout function calls the backend API to blacklist the JWT token
 * before clearing local state. This ensures the token cannot be reused
 * after logout (the backend checks the blacklist on every authenticated request).
 * If the API call fails, we still clear local state so the user is logged out
 * locally even if the server-side blacklist couldn't be updated.
 */
import { useAppSelector, useAppDispatch } from '@/shared/store';
import { setCredentials, logout, setAuthLoading, setAuthError } from './authSlice';
import type { AuthUser } from '@/shared/types';

export function useAuth() {
  const dispatch = useAppDispatch();
  const { token, user, isAuthenticated, loading, error } = useAppSelector((s) => s.auth);

  const handleLogout = async () => {
    // Call backend to blacklist the token so it can't be reused.
    // We fire-and-forget: even if this fails, we still clear local state.
    if (token) {
      try {
        const { API_URLS } = await import('@/shared/store/api');
        await fetch(`${API_URLS.auth}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Silently ignore — local logout proceeds regardless
      }
    }
    dispatch(logout());
  };

  return {
    token,
    user,
    isAuthenticated,
    loading,
    error,
    login: (credentials: { token: string; user: AuthUser }) => dispatch(setCredentials(credentials)),
    logout: handleLogout,
    setLoading: (v: boolean) => dispatch(setAuthLoading(v)),
    setError: (e: string | null) => dispatch(setAuthError(e)),
  };
}