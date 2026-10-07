/**
 * Every word of the install and reminders UI, from the i18n catalog (src/lib/i18n/en/pwa.ts and
 * ru/pwa.ts) in the viewer's language. The components take this object rather than calling t()
 * themselves, so the sheet stays a plain component. `{share}`, `{more}`, `{add}` and `{menu}` in a
 * step are drawn as the icon the person has to look for (InstallSheet.tsx).
 */
import { t, type Locale, type MessageKey } from '../../lib/i18n';
import '@/lib/i18n/catalogs/pwa';

const KEYS = [
  'appName',
  'cardTitlePhone',
  'cardTitleComputer',
  'cardTitleInApp',
  'cardBody',
  'cardBodyComputer',
  'cardBodyInApp',
  'teacherLine',
  'install',
  'installApp',
  'showMeHow',
  'notNow',
  'pushTitle',
  'pushBody',
  'pushLine',
  'turnOn',
  'pushOnToast',
  'pushBlockedToast',
  'iosTitle',
  'iosLead',
  'iosStepShareMore',
  'iosStepShare',
  'iosStepShareTop',
  'iosStepShareChrome',
  'iosStepAdd',
  'iosStepConfirm',
  'iosStepConfirmWebApp',
  'more',
  'share',
  'addToHomeScreen',
  'copy',
  'addBookmark',
  'toolbarHint',
  'gotIt',
  'alreadyAdded',
  'inAppStepMenu',
  'inAppOr',
  'copyLink',
  'copied',
  'menu',
  'manualTitle',
  'manualLeadAndroid',
  'manualLeadDesktop',
  'manualStepAndroid',
  'manualStepAndroid2',
  'manualStepDesktop',
  'manualStepDesktop2',
  'close',
  'entryTitle',
  'entryDescription',
  'entryUnsupported',
  'remindersTitle',
  'remindersDescription',
  'remindersChecking',
  'remindersNeedsInstall',
  'remindersOff',
  'remindersOn',
  'turnOff',
  'remindersDeniedIos',
  'remindersDeniedAndroid',
  'remindersDeniedDesktop',
  'remindersFailed',
] as const;

export type InstallCopy = Record<(typeof KEYS)[number], string> & {
  inAppTitle: (browser: string) => string;
  inAppLead: (app: string | null, browser: string) => string;
  inAppStepOpen: (browser: string) => string;
};

export function installCopy(locale: Locale): InstallCopy {
  const m = (key: string, params?: Record<string, string>) => t(`pwa.${key}` as MessageKey, params, locale);
  const copy = Object.fromEntries(KEYS.map((key) => [key, m(key)])) as Record<(typeof KEYS)[number], string>;
  return {
    ...copy,
    inAppTitle: (browser) => m('inAppTitle', { browser }),
    inAppLead: (app, browser) => (app ? m('inAppLeadNamed', { app, browser }) : m('inAppLead', { browser })),
    inAppStepOpen: (browser) => m('inAppStepOpen', { browser }),
  };
}
