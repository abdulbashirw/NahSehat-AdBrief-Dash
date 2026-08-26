/**
 * i18n public API.
 *
 * Usage:
 *   import { useTranslation } from '@/shared/i18n';
 *   const { t } = useTranslation();
 *   t('settings.title')
 */
export { default as i18n, localeToLang, langToLocale, DEFAULT_LANG, SUPPORTED_LANGS } from './i18n';
export type { LangCode } from './i18n';
export { useLanguageSync, persistLanguageChange, LANG_STORAGE_KEY } from './LanguageProvider';