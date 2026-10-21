import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PublicShell from '../components/open-webinars/PublicShell';
import { usePageTitle } from '../components/open-webinars/usePageTitle';
import { getPrivacyPolicy } from '../services/api/publicWebinars';
import { formatDate } from '../lib/i18n/format';
import { usePublicLocale } from '../lib/publicLocale';
import '@/lib/i18n/catalogs/openWebinars';

type State = { kind: 'loading' } | { kind: 'ready'; text: string; updatedAt: string | null } | { kind: 'missing' };

/** `/privacy`: the policy exactly as the admin published it (plain text, paragraphs kept). */
export default function PrivacyPolicyPage() {
  const { locale, setLocale, t } = usePublicLocale();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    getPrivacyPolicy()
      .then((policy) => live && setState({ kind: 'ready', text: policy.text, updatedAt: policy.updated_at }))
      .catch(() => live && setState({ kind: 'missing' }));
    return () => { live = false; };
  }, []);

  usePageTitle(t('openWebinars.privacy.title'));

  return (
    <PublicShell locale={locale} setLocale={setLocale} t={t} hidePrivacyLink>
      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-foreground">{t('openWebinars.privacy.title')}</h1>
        {state.kind === 'loading' && <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{t('openWebinars.loading')}</p>}
        {state.kind === 'missing' && <p className="mt-4 text-sm text-muted-foreground">{t('openWebinars.privacy.missing')}</p>}
        {state.kind === 'ready' && (
          <>
            {state.updatedAt && <p className="mt-1 text-xs text-muted-foreground">{formatDate(state.updatedAt, undefined, locale)}</p>}
            <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{state.text}</div>
          </>
        )}
      </article>
    </PublicShell>
  );
}
