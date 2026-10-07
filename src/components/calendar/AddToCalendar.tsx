/**
 * One feed's actions in the subscribe dialog: the device's calendar app as the primary button
 * (one tap opens it with the subscription), "Other calendar apps" for the rest, and "Copy link",
 * which leads instead inside Telegram & co., where no calendar app can open.
 */
import type { ReactNode } from 'react';
import { CalendarPlus, ChevronDown, Copy, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { feedActions, feedLinks, type CalendarApp, type FeedSource } from '../../lib/calendarApps';
import type { PlatformEnv } from '../../lib/pwaPlatform';
import type { MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/calendar';

const ADD_LABEL: Record<CalendarApp, MessageKey> = {
  apple: 'calendar.subscribe.addToApple',
  google: 'calendar.subscribe.addToGoogle',
  outlook: 'calendar.subscribe.addToOutlook',
  office: 'calendar.subscribe.addToOffice',
};

const APP_LABEL: Record<CalendarApp, MessageKey> = {
  apple: 'calendar.subscribe.app.apple',
  google: 'calendar.subscribe.app.google',
  outlook: 'calendar.subscribe.app.outlook',
  office: 'calendar.subscribe.app.office',
};

/** A webcal link hands off to the system and leaves the page as it is; web calendars open a tab. */
const linkProps = (app: CalendarApp, href: string) =>
  app === 'apple' ? { href } : { href, target: '_blank', rel: 'noopener noreferrer' };

interface AddToCalendarProps {
  source: FeedSource;
  env: PlatformEnv;
  onCopy: () => void;
  /** More actions after "Copy link" (the personal feed's "Reset link"). */
  children?: ReactNode;
}

export default function AddToCalendar({ source, env, onCopy, children }: AddToCalendarProps) {
  const t = useT();
  const links = feedLinks(source);
  const { primary, others } = feedActions(links, env);

  const copyButton = (lead: boolean) => (
    <Button size="sm" variant={lead ? 'default' : 'outline'} onClick={onCopy}>
      <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      {t('calendar.subscribe.copyLink')}
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary ? (
        <Button size="sm" asChild>
          <a {...linkProps(primary, links[primary]!)}>
            <CalendarPlus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            {t(ADD_LABEL[primary])}
          </a>
        </Button>
      ) : (
        copyButton(true)
      )}

      {others.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              {t('calendar.subscribe.otherApps')}
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[14rem]">
            {others.map((app) => (
              <DropdownMenuItem key={app} asChild>
                <a {...linkProps(app, links[app]!)} className="flex cursor-pointer items-center justify-between gap-3">
                  {t(APP_LABEL[app])}
                  {app !== 'apple' && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
                </a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {primary && copyButton(false)}
      {children}
    </div>
  );
}
