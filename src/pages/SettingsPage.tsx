import { useMemo, type ReactNode } from 'react';
import { Bell, CalendarDays, Download, Languages, LifeBuoy, Palette, Send, ShieldCheck, Smartphone, Wrench } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';
import { replayTourFor } from '../lib/guide/state';
import { isInstalled, usePwaInstall } from '../services/pwaInstall';
import { SettingsSection } from '../components/settings/SettingsSection';
import SettingsNav, { type NavItem } from '../components/settings/SettingsNav';
import AppearanceSection from '../components/settings/AppearanceSection';
import LanguageSection from '../components/settings/LanguageSection';
import NotificationsSection from '../components/settings/NotificationsSection';
import TelegramSection from '../components/settings/TelegramSection';
import PushSection from '../components/settings/PushSection';
import CalendarSection from '../components/settings/CalendarSection';
import SecuritySection from '../components/settings/SecuritySection';
import HelpSection from '../components/settings/HelpSection';
import AdminProgressTool from '../components/settings/AdminProgressTool';
import InstallAppEntry from '../components/pwa/InstallAppEntry';

/**
 * Settings: how the app works for you (owner Q7/Q10, 2026-10-07). Who you are lives on Profile.
 * Sections in the owner's order; each is its own component under components/settings.
 */
export default function SettingsPage() {
  const t = useT();
  const { user } = useAuth();
  const pwa = usePwaInstall();
  const role = user?.role;
  const tour = replayTourFor(role);

  const sections = useMemo(() => {
    const list: (NavItem & { node: ReactNode })[] = [
      { id: 'appearance', icon: Palette, title: t('settings.appearance.title'), node: <AppearanceSection /> },
      { id: 'language', icon: Languages, title: t('settings.language.title'), node: <LanguageSection /> },
      { id: 'notifications', icon: Bell, title: t('settings.notifications.title'), node: <NotificationsSection /> },
      { id: 'telegram', icon: Send, title: t('settings.telegram.title'), node: <TelegramSection /> },
      { id: 'push', icon: Smartphone, title: t('settings.push.title'), node: <PushSection /> },
    ];
    // Parents have no lesson calendar of their own.
    if (role !== 'parent') list.push({ id: 'calendar', icon: CalendarDays, title: t('settings.calendar.title'), node: <CalendarSection /> });
    list.push({ id: 'security', icon: ShieldCheck, title: t('settings.security.title'), node: <SecuritySection /> });
    if (tour) list.push({ id: 'help', icon: LifeBuoy, title: t('settings.help.title'), node: <HelpSection kind={tour} /> });
    if (!isInstalled(pwa)) {
      list.push({
        id: 'install',
        icon: Download,
        title: t('settings.install.title'),
        node: (
          <SettingsSection id="install" title={t('settings.install.title')}>
            <InstallAppEntry />
          </SettingsSection>
        ),
      });
    }
    if (role === 'admin') {
      list.push({
        id: 'admin',
        icon: Wrench,
        title: t('settings.admin.title'),
        node: (
          <section id="admin" aria-labelledby="admin-title" className="scroll-mt-24 space-y-3">
            <h2 id="admin-title" className="px-1 text-lg font-semibold text-foreground">
              {t('settings.admin.title')}
            </h2>
            <AdminProgressTool />
          </section>
        ),
      });
    }
    return list;
  }, [t, role, tour, pwa]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">{t('settings.subtitle')}</p>
      </header>
      <div className="@4xl:grid @4xl:grid-cols-[12.5rem_minmax(0,1fr)] @4xl:gap-8">
        <SettingsNav items={sections} label={t('settings.nav.label')} />
        <div className="min-w-0 max-w-3xl space-y-10">
          {sections.map((s) => (
            <div key={s.id}>{s.node}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
