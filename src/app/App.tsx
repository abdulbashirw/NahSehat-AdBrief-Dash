/**
 * App — root component with Redux Provider, Router, Auth Initializer, i18n, Error Boundary, and Suspense.
 */
import { Suspense } from 'react';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/shared/store';
import { routeConfig } from '@/app/routes';
import AuthInitializer from '@/widgets/auth-initializer/ui/AuthInitializer';
import ErrorBoundary from '@/shared/components/error/ErrorBoundary';
import { Toaster } from '@/shared/ui/sonner';
// i18n — must be imported so the instance is initialised before any render
import '@/shared/i18n/i18n';
import { LanguageSync } from '@/widgets/language-sync/ui/LanguageSync';

function AppRoutes() {
  return useRoutes(routeConfig);
}

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AuthInitializer>
          <LanguageSync />
          <Toaster position="top-center" richColors closeButton />
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8]">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
                </div>
              }
            >
              <AppRoutes />
            </Suspense>
          </ErrorBoundary>
        </AuthInitializer>
      </BrowserRouter>
    </Provider>
  );
}

export default App;