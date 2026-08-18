/**
 * AuthInitializer — validates stored token on mount and restores session.
 * Wraps the app to ensure auth state is ready before rendering routes.
 *
 * On mount, if a token exists in localStorage, this component validates it
 * against the backend. If the token is invalid (expired, blacklisted, etc.),
 * the local state is cleared and the user is redirected to login.
 *
 * Also handles edge cases where the token exists but user data is missing
 * (e.g., corrupted storage, manual localStorage edits).
 */
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/store';
import { setCredentials, logout } from '@/entities/auth/model/authSlice';
import { API_URLS } from '@/shared/store/api';

const TOKEN_KEY = 'nahsehat_token';
const USER_KEY = 'nahsehat_user';

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((s) => s.auth);
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidated(true);
      return;
    }

    // If user data exists in Redux state (restored from localStorage),
    // we still validate the token with the backend to ensure it's not
    // blacklisted or expired.
    const validateStoredToken = async () => {
      try {
        const res = await fetch(`${API_URLS.auth}/validate`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          // Token is invalid (expired, blacklisted, etc.) — clear local state
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          dispatch(logout());
          return;
        }

        const data = await res.json();

        if (data.valid && data.user) {
          // Token is valid — update user data from server response
          // (ensures role/permissions are up-to-date)
          dispatch(setCredentials({ token, user: data.user }));
        } else {
          // Token validation returned invalid — clear local state
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          dispatch(logout());
        }
      } catch {
        // Network error — we can't validate the token.
        // Keep the local state as-is so the user can still use the app
        // if they have a valid token. Individual API calls will fail
        // with 401 if the token is actually invalid.
        if (token && !user) {
          // Edge case: token exists but user data is missing from Redux state.
          const storedUser = localStorage.getItem(USER_KEY);
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              dispatch(setCredentials({ token, user: parsedUser }));
            } catch {
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(USER_KEY);
              dispatch(logout());
            }
          } else {
            localStorage.removeItem(TOKEN_KEY);
            dispatch(logout());
          }
        }
      } finally {
        setValidated(true);
      }
    };

    validateStoredToken();
  }, [token, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for token validation before rendering routes.
  // This prevents a flash of the login page when a valid token exists,
  // or a flash of the dashboard when the token is invalid.
  if (token && !validated) {
    return null;
  }

  return <>{children}</>;
}