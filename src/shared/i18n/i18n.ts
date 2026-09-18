/**
 * i18n configuration — react-i18next + i18next.
 *
 * Default language: en (English)
 * Supported: en, id
 *
 * Language is synced with the backend setting `currency.locale` via LanguageProvider.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import id from './id.json';

export const SUPPORTED_LANGS = ['en', 'id'] as const;
export type LangCode = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: LangCode = 'en';
export const LANG_STORAGE_KEY = 'nahsehat_lang';

function getStoredLang(): LangCode {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'en' || stored === 'id') return stored;
  } catch {
    // private mode / blocked storage
  }
  return DEFAULT_LANG;
}

/** Map backend locale values (id-ID, en-US) to our i18n codes (id, en). */
export function localeToLang(locale: string): LangCode {
  if (locale.startsWith('en')) return 'en';
  return 'id';
}

/** Map our i18n codes to full locale strings for Intl formatting. */
export function langToLocale(lang: LangCode): string {
  return lang === 'en' ? 'en-US' : 'id-ID';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    id: { translation: id },
  },
  lng: getStoredLang(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export default i18n;