/**
 * Auth slice — manages JWT token, current user, and login status.
 *
 * Token is persisted to localStorage for session recovery.
 * On app mount, the slice checks for an existing token and validates it.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser } from '@/shared/types';

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const storedToken = localStorage.getItem('nahsehat_token');
const storedUser = localStorage.getItem('nahsehat_user');
let parsedUser: AuthUser | null = null;
if (storedUser) {
  try {
    parsedUser = JSON.parse(storedUser);
  } catch {
    localStorage.removeItem('nahsehat_user');
  }
}

const initialState: AuthState = {
  token: storedToken,
  user: parsedUser,
  isAuthenticated: !!(storedToken && parsedUser),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; user: AuthUser }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;
      localStorage.setItem('nahsehat_token', action.payload.token);
      localStorage.setItem('nahsehat_user', JSON.stringify(action.payload.user));
    },
    logout(state) {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      localStorage.removeItem('nahsehat_token');
      localStorage.removeItem('nahsehat_user');
    },
    setAuthLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setAuthError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.loading = false;
    },
    updateUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
    },
  },
});

export const { setCredentials, logout, setAuthLoading, setAuthError, updateUser } = authSlice.actions;
export default authSlice.reducer;