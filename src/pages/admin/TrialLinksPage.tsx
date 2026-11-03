import { useCallback, useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useAuth } from '../../contexts/AuthContext';
import { useT } from '../../lib/i18n/react';
import { cn } from '../../lib/utils';
import OverviewTab from '../../components/trial-links/admin/OverviewTab';
import SignupsTab from '../../components/trial-links/admin/SignupsTab';
import PresentTab from '../../components/trial-links/admin/PresentTab';
import LinksTab from '../../components/trial-links/admin/LinksTab';
import SchoolsTab from '../../components/trial-links/admin/SchoolsTab';
import SettingsTab from '../../components/trial-links/admin/SettingsTab';
import { getTrialLinkSettings, listTrialLinks, type TrialLinkRow, type TrialLinkSettings } from '../../services/api/trialLinks';
import '@/lib/i18n/catalogs/trialLinks';

const TABS = ['overview', 'signups', 'present', 'links', 'schools', 'settings'] as const;
type Tab = (typeof TABS)[number];
const TAB_KEY = 'tl:admin-tab';

function initialTab(): Tab {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    return (TABS as readonly string[]).includes(saved ?? '') ? (saved as Tab) : 'overview';
  } catch {
    return 'overview';
  }
}

/** /admin/trial-links: QR sign-ups from school presentations (admins, head curators, marketing). */
export default function TrialLinksPage() {
  const t = useT();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [links, setLinks] = useState<TrialLinkRow[]>([]);
  const [settings, setSettings] = useState<TrialLinkSettings | null>(null);

  const reloadLinks = useCallback(() => { listTrialLinks().then(setLinks).catch(() => undefined); }, []);
  const reloadSettings = useCallback(() => { getTrialLinkSettings().then(setSettings).catch(() => undefined); }, []);
  useEffect(() => { reloadLinks(); reloadSettings(); }, [reloadLinks, reloadSettings]);

  const choose = (next: string) => {
    setTab(next as Tab);
    try { localStorage.setItem(TAB_KEY, next); } catch { /* storage blocked: the tab is just not remembered */ }
  };

  const Pill = ({ on, onText, offText }: { on: boolean; onText: string; offText: string }) => (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
      on ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-emerald-500' : 'bg-muted-foreground/60')} />
      {on ? onText : offText}
    </span>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><QrCode className="h-5 w-5" aria-hidden /></span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('trialLinks.admin.title')}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{t('trialLinks.admin.subtitle')}</p>
          </div>
        </div>
        {settings && (
          <div className="flex flex-wrap gap-2">
            <Pill on={settings.signups_open} onText={t('trialLinks.admin.status.signupsOpen')} offText={t('trialLinks.admin.status.signupsClosed')} />
            <Pill on={settings.leads_enabled} onText={t('trialLinks.admin.status.amoOn')} offText={t('trialLinks.admin.status.amoOff')} />
          </div>
        )}
      </header>

      <Tabs value={tab} onValueChange={choose}>
        <TabsList className="h-auto flex-wrap justify-start">
          {TABS.map((key) => <TabsTrigger key={key} value={key}>{t(`trialLinks.admin.tab.${key}`)}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview" className="mt-5"><OverviewTab links={links} /></TabsContent>
        <TabsContent value="signups" className="mt-5"><SignupsTab links={links} /></TabsContent>
        <TabsContent value="present" className="mt-5"><PresentTab links={links} /></TabsContent>
        <TabsContent value="links" className="mt-5"><LinksTab links={links} onChanged={reloadLinks} /></TabsContent>
        <TabsContent value="schools" className="mt-5"><SchoolsTab /></TabsContent>
        <TabsContent value="settings" className="mt-5">
          <SettingsTab settings={settings} canEdit={user?.role === 'admin'} onSaved={setSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
