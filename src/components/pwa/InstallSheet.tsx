import { useEffect, useState, type ReactNode } from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { ArrowDown, BookOpen, Check, Copy, Ellipsis, EllipsisVertical, Share, SquarePlus, X, type LucideIcon } from 'lucide-react';
import { Button } from '../ui/button';
import type { PlatformInfo } from '../../lib/pwaPlatform';
import type { InstallCopy } from './installCopy';

/** Which instructions a platform needs when there's no one-tap prompt. */
export type SheetKind = 'ios' | 'in-app' | 'android-manual' | 'desktop-manual';

export function sheetKindFor(platform: PlatformInfo): SheetKind | null {
  switch (platform.platform) {
    case 'ios-safari':
      return 'ios';
    case 'ios-in-app':
    case 'android-in-app':
      return 'in-app';
    case 'android':
      return 'android-manual';
    case 'desktop':
      return 'desktop-manual';
    default:
      return null;
  }
}

const SCRIM =
  'fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] dark:bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0';

// A bottom sheet on a phone (thumb reach, and Safari's toolbar sits right under it); a centred
// dialog from 640 px up.
const PANEL =
  'fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-popover text-popover-foreground shadow-2xl outline-none ' +
  'px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] duration-300 ease-out ' +
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom ' +
  'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(28rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:p-6 sm:duration-200 ' +
  'sm:data-[state=open]:fade-in-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%] ' +
  'sm:data-[state=closed]:fade-out-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%]';

const SOLID = 'bg-brand-solid text-brand-solid-foreground hover:bg-brand-solid-hover';

/** The button the person has to find, drawn inline in the sentence. */
function Chip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="inline-flex translate-y-[-1px] items-center gap-1 whitespace-nowrap rounded-md border border-border bg-muted px-1.5 py-px align-middle text-[0.8125rem] font-medium leading-5 text-foreground">
      <Icon className="h-3.5 w-3.5 text-brand" aria-hidden />
      {label}
    </span>
  );
}

function Template({ text, chips }: { text: string; chips: Record<string, ReactNode> }) {
  return (
    <>
      {text.split(/(\{\w+\})/).map((part, i) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1];
        return <span key={i}>{name && chips[name] ? chips[name] : part}</span>;
      })}
    </>
  );
}

function Steps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold tabular-nums text-brand-subtle-foreground">
            {i + 1}
          </span>
          <p className="min-w-0 pt-0.5 text-sm leading-6 text-foreground">{step}</p>
        </li>
      ))}
    </ol>
  );
}

/** A sketch of the iOS share sheet with the row to tap lit up: the step people get lost on. */
function ShareSheetSketch({ t }: { t: InstallCopy }) {
  const rows: { icon: LucideIcon; label: string; target?: boolean }[] = [
    { icon: Copy, label: t.copy },
    { icon: BookOpen, label: t.addBookmark },
    { icon: SquarePlus, label: t.addToHomeScreen, target: true },
  ];
  return (
    <div aria-hidden className="rounded-2xl bg-muted p-1.5">
      <div className="overflow-hidden rounded-xl bg-card text-sm ring-1 ring-border">
        {rows.map(({ icon: Icon, label, target }) => (
          <div
            key={label}
            className={
              target
                ? 'relative flex items-center justify-between bg-brand-surface px-3.5 py-2.5 font-medium text-brand-surface-foreground ring-2 ring-inset ring-brand-border'
                : 'flex items-center justify-between border-b border-border px-3.5 py-2.5 text-muted-foreground'
            }
          >
            <span className="truncate">{label}</span>
            <Icon className={target ? 'h-4 w-4 flex-none text-brand' : 'h-4 w-4 flex-none'} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CopyLink({ t }: { t: InstallCopy }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Old in-app WebViews have no clipboard API: select the text so a long-press copies it.
      const field = document.getElementById('pwa-install-link') as HTMLInputElement | null;
      field?.select();
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t.inAppOr}</p>
      <div className="flex min-w-0 items-center gap-2">
        <input
          id="pwa-install-link"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 truncate rounded-md border border-input bg-background px-3 text-sm text-foreground"
          aria-label={t.copyLink}
        />
        <Button type="button" variant="outline" onClick={copy} className="h-10 flex-none gap-1.5" aria-live="polite">
          {copied ? <Check className="h-4 w-4 text-brand" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? t.copied : t.copyLink}
        </Button>
      </div>
    </div>
  );
}

export interface InstallSheetProps {
  kind: SheetKind;
  platform: PlatformInfo;
  t: InstallCopy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** iOS only: the person says the app is on their Home Screen (iOS never tells the page). */
  onMarkedInstalled?: () => void;
}

export default function InstallSheet({ kind, platform, t, open, onOpenChange, onMarkedInstalled }: InstallSheetProps) {
  const isAndroid = platform.platform === 'android-in-app' || platform.platform === 'android';
  // Android and Chrome draw their menus as a vertical ⋮; iOS apps as ⋯.
  const chips = {
    share: <Chip icon={Share} label={t.share} />,
    more: <Chip icon={isAndroid ? EllipsisVertical : Ellipsis} label={t.more} />,
    add: <Chip icon={SquarePlus} label={t.addToHomeScreen} />,
    menu: <Chip icon={EllipsisVertical} label={t.menu} />,
  };
  const browser = isAndroid ? 'Chrome' : 'Safari';
  const iphone = typeof navigator !== 'undefined' && /iPhone|iPod/.test(navigator.userAgent);

  let title = t.iosTitle;
  let lead = t.iosLead;
  let steps: ReactNode[] = [];
  if (kind === 'ios') {
    const shareStep =
      platform.iosBrowser === 'chrome'
        ? t.iosStepShareChrome
        : platform.shareInMoreMenu
          ? t.iosStepShareMore
          : iphone
            ? t.iosStepShare
            : t.iosStepShareTop;
    steps = [
      <Template text={shareStep} chips={chips} />,
      <Template text={t.iosStepAdd} chips={chips} />,
      platform.shareInMoreMenu ? t.iosStepConfirmWebApp : t.iosStepConfirm,
    ];
  } else if (kind === 'in-app') {
    title = t.inAppTitle(browser);
    lead = t.inAppLead(platform.inAppName, browser);
    steps = [<Template text={t.inAppStepMenu} chips={chips} />, t.inAppStepOpen(browser)];
  } else if (kind === 'android-manual') {
    title = t.manualTitle;
    lead = t.manualLeadAndroid;
    steps = [<Template text={t.manualStepAndroid} chips={chips} />, t.manualStepAndroid2];
  } else {
    title = t.manualTitle;
    lead = t.manualLeadDesktop;
    steps = [<Template text={t.manualStepDesktop} chips={chips} />, t.manualStepDesktop2];
  }
  const toolbarBelow = kind === 'ios' && platform.iosBrowser === 'safari' && iphone;

  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className={SCRIM} />
        <SheetPrimitive.Content className={PANEL} data-testid="pwa-install-sheet">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
          <SheetPrimitive.Close
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t.close}
          >
            <X className="h-4 w-4" aria-hidden />
          </SheetPrimitive.Close>

          <div className="flex items-center gap-3 pr-8">
            <img src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 flex-none rounded-[12px] shadow-sm ring-1 ring-border" />
            <SheetPrimitive.Title className="text-lg font-semibold leading-snug text-foreground [text-wrap:balance]">{title}</SheetPrimitive.Title>
          </div>
          <SheetPrimitive.Description className="mt-3 text-sm leading-6 text-muted-foreground">{lead}</SheetPrimitive.Description>

          <div className="mt-5 space-y-5">
            <Steps steps={steps} />
            {kind === 'ios' && <ShareSheetSketch t={t} />}
            {kind === 'in-app' && <CopyLink t={t} />}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <SheetPrimitive.Close asChild>
              <Button type="button" className={`h-11 w-full ${SOLID}`}>
                {t.gotIt}
              </Button>
            </SheetPrimitive.Close>
            {kind === 'ios' && onMarkedInstalled && (
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full text-muted-foreground"
                onClick={() => {
                  onMarkedInstalled();
                  onOpenChange(false);
                }}
              >
                {t.alreadyAdded}
              </Button>
            )}
          </div>

          {toolbarBelow && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground sm:hidden">
              <ArrowDown className="h-3.5 w-3.5 text-brand" aria-hidden />
              {t.toolbarHint}
            </p>
          )}
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}
