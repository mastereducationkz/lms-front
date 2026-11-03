import { Library } from 'lucide-react';
import { useT } from '@/lib/i18n/react';
import { BackLink, PageShell } from '@/components/staff-training/PageShell';
import LibraryView from '@/components/staff-training/LibraryView';
import '@/lib/i18n/catalogs/staffTraining';

/** /training/library: every clip, by track. */
export default function TrainingLibraryPage() {
  const t = useT();
  return (
    <PageShell>
      <BackLink to="/training">{t('staffTraining.backToTrack')}</BackLink>
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Library className="h-5 w-5" aria-hidden /></span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('staffTraining.library.title')}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t('staffTraining.library.intro')}</p>
        </div>
      </header>
      <LibraryView />
    </PageShell>
  );
}
