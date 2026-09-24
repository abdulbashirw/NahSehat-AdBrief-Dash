/**
 * Listener middleware — keeps the session-expiry timer in sync with auth state.
 *
 *  setCredentials → (re)schedule the expiry timer from the JWT `exp` claim
 *  logout         → clear the timer
 *
 * Registered in shared/store/index.ts. See sessionExpiry.ts for the
 * full expired-session strategy.
 */
import { createListenerMiddleware } from '@reduxjs/toolkit';
import { setCredentials, logout } from './authSlice';
import { scheduleSessionExpiryTimer, clearSessionExpiryTimer } from './sessionExpiry';

export const tokenExpiryListenerMiddleware = createListenerMiddleware();

tokenExpiryListenerMiddleware.startListening({
  actionCreator: setCredentials,
  effect: () => {
    void scheduleSessionExpiryTimer();
  },
});

tokenExpiryListenerMiddleware.startListening({
  actionCreator: logout,
  effect: () => {
    clearSessionExpiryTimer();
  },
});