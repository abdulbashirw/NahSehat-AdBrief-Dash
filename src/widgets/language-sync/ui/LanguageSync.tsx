/**
 * LanguageSync — invisible component that keeps i18next and format.ts in sync.
 *
 * Must be rendered inside <Provider> and <AuthInitializer> so that
 * useLanguageSync can access Redux state (auth role + settings).
 */
import { useLanguageSync } from '@/shared/i18n';
import { _setFormatLang } from '@/shared/lib/format';
import { useEffect } from 'react';
import type { LangCode } from '@/shared/i18n/i18n';

export default function LanguageSyncInner() {
  const lang = useLanguageSync();

  useEffect(() => {
    _setFormatLang(lang as LangCode);
  }, [lang]);

  // This component renders nothing — it's purely a side-effect bridge.
  return null;
}

/**
 * Public export — named <LanguageSync> for use in App.tsx.
 */
export const LanguageSync = LanguageSyncInner;