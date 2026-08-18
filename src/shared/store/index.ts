/**
 * Redux store configuration.
 *
 * Uses Redux Toolkit with RTK Query for API communication.
 * Store is configured with auth slice and API middleware.
 */
import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import authReducer from '@/entities/auth/model/authSlice';
import dashboardReducer from './slices/dashboardSlice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
    dashboard: dashboardReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
  devTools: import.meta.env.VITE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';

/** Typed dispatch hook */
export const useAppDispatch = () => useDispatch<AppDispatch>();
/** Typed selector hook */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;