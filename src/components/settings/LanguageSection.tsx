import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import type { Locale } from '../../lib/i18n';
import { useLocale, useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';
import { useLookupLang } from '../lesson/lookup/lookupLang';
import type { LookupLang } from '../../services/api/lookup';
import { saveUiLanguage } from '../../services/api/auth';
import { Segmented, SettingsRow, SettingsSection } from './SettingsSection';

/**
 * The app's language — each person's own choice since Q27 (2026-10-07); without one, the role
 * decides (lib/i18n/locale.ts) — and Look Up's translation language, the same choice the lesson
 * popover makes. The language names are written in their own language, as every app does.
 */
export default function LanguageSection() {
  const t = useT();
  const locale = useLocale();
  const { user, updateUser } = useAuth();
  const [lookup, setLookup] = useLookupLang();
  const [saving, setSaving] = useState(false);
  // Parents never read lessons, so Look Up means nothing to them.
  const showLookup = user?.role !== 'parent';

  const chooseLanguage = async (next: Locale) => {
    if (!user || next === locale || saving) return;
    setSaving(true);
    // Switch at once; the saved record follows (and puts it back if the save fails).
    updateUser({ ...user, ui_language: next });
    try {
      updateUser(await saveUiLanguage(next));
    } catch {
      updateUser(user);
      toast.error(t('settings.language.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection id="language" title={t('settings.language.title')} description={t('settings.language.description')}>
      <SettingsRow label={t('settings.language.app')} description={t('settings.language.appNote')}>
        <Segmented<Locale>
          label={t('settings.language.app')}
          value={locale}
          onChange={chooseLanguage}
          options={[
            { value: 'en', label: t('settings.language.english') },
            { value: 'ru', label: t('settings.language.russian') },
          ]}
        />
      </SettingsRow>
      {showLookup && (
        <SettingsRow label={t('settings.language.lookup')} description={t('settings.language.lookupNote')}>
          <Segmented<LookupLang>
            label={t('settings.language.lookup')}
            value={lookup}
            onChange={setLookup}
            options={[
              { value: 'ru', label: t('settings.language.lookupRu') },
              { value: 'kk', label: t('settings.language.lookupKk') },
            ]}
          />
        </SettingsRow>
      )}
    </SettingsSection>
  );
}
