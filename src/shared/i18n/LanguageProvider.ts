/**
 * LanguageProvider — syncs the backend `currency.locale` setting with i18next.
 *
 * On mount (for SUPER_ADMIN / ADMIN), it fetches settings and applies the
 * stored language. For non-admin users it falls back to localStorage or the
 * default (en).
 *
 * When the user changes language in Settings, the provider detects the change
 * and applies it immediately.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetSettingsQuery } from '@/entities/settings/api/settingApi';
import { useHasAnyRole } from '@/entities/auth/model/useRbac';
import i18n, { localeToLang, type LangCode } from '@/shared/i18n/i18n';

const LANG_STORAGE_KEY = 'nahsehat_lang';

export function useLanguageSync() {
  const { i18n } = useTranslation();
  const hasAnyRole = useHasAnyRole();
  const isSuperAdmin = hasAnyRole(['SUPER_ADMIN']);
  const { data: settingsData } = useGetSettingsQuery(undefined, {
    skip: !isSuperAdmin,
    pollingInterval: 30_000, // pick up setting changes from other sessions
  });
  const applied = useRef<string | null>(null);

  useEffect(() => {
    // Priority: 1) backend setting (admin only), 2) localStorage, 3) default
    let lang: LangCode;

    if (isSuperAdmin && settingsData) {
      const localeSetting = settingsData.find((s) => s.key === 'currency.locale');
      const locale = localeSetting?.value ?? 'en-US';
      lang = localeToLang(locale);
    } else {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      lang = (stored === 'en' || stored === 'id') ? stored as LangCode : 'en';
    }

    if (applied.current !== lang) {
      applied.current = lang;
      i18n.changeLanguage(lang);
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    }
  }, [i18n, isSuperAdmin, settingsData]);

  return i18n.language as LangCode;
}

/**
 * Persist language change to both i18next and localStorage.
 * Called from SettingsPage when user saves language.
 */
export function persistLanguageChange(lang: LangCode) {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
}

export { LANG_STORAGE_KEY };