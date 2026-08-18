/**
 * Dashboard slice — manages global dashboard state (sidebar, filters, theme).
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface DashboardState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
}

const initialState: DashboardState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  theme: 'light',
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    toggleSidebarCollapsed(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setTheme(state, action: PayloadAction<'light' | 'dark'>) {
      state.theme = action.payload;
    },
  },
});

export const { toggleSidebar, setSidebarOpen, toggleSidebarCollapsed, setTheme } = dashboardSlice.actions;
export default dashboardSlice.reducer;