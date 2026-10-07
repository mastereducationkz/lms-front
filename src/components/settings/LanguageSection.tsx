import { useAuth } from '../../contexts/AuthContext';
import { useLocale, useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';
import { useLookupLang } from '../lesson/lookup/lookupLang';
import type { LookupLang } from '../../services/api/lookup';
import { Segmented, SettingsRow, SettingsSection } from './SettingsSection';

/**
 * The app's language (one per role for now, owner 2026-10-07: read-only here until a per-user
 * switch exists) and Look Up's translation language, the same choice the lesson popover makes.
 */
export default function LanguageSection() {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const [lookup, setLookup] = useLookupLang();
  // Parents never read lessons, so Look Up means nothing to them.
  const showLookup = user?.role !== 'parent';

  return (
    <SettingsSection id="language" title={t('settings.language.title')} description={t('settings.language.description')}>
      <SettingsRow label={t('settings.language.app')} description={t('settings.language.appNote')}>
        <span className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
          {locale === 'ru' ? t('settings.language.russian') : t('settings.language.english')}
        </span>
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
