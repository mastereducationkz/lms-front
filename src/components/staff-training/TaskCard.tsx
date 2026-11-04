import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/react';
import { formatDateTime } from '@/lib/i18n/format';
import { checkTask, openTask, resetPractice, type CheckResult, type TaskResult, type TaskSummary } from '@/services/api/staffTraining';
import RichText from './RichText';
import { errorText, pick } from './model';
import '@/lib/i18n/catalogs/staffTraining';

const CHECK_COOLDOWN_MS = 5000; // the server allows one check per 5 s (CONTRACTS §6.1)

interface Props {
  task: TaskSummary;
  locale: 'ru' | 'en';
  done: boolean;
  /** A check came back: the page reloads the track and shows the next step. */
  onChecked: (result: CheckResult) => void;
}

/**
 * A practice task: its instructions, «Open the training copy», «Check» and «Start the practice over».
 *
 * «Open» asks the server for a sign-in link that works once, so it is only ever requested by a click (never when
 * the card shows). The new tab is opened in the click itself and sent to the link when it arrives: the server may
 * take several seconds to get the training copy ready, and a tab opened after that wait is blocked by browsers.
 */
export default function TaskCard({ task, locale, done, onChecked }: Props) {
  const t = useT();
  const [opening, setOpening] = useState(false);
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [cooling, setCooling] = useState(false);
  const [result, setResult] = useState<TaskResult | null>(task.last_result ?? null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { setResult(task.last_result ?? null); }, [task.last_result]);

  const open = async () => {
    setOpening(true);
    setError(null);
    setBlockedUrl(null);
    const tab = window.open('', '_blank');
    try {
      if (tab) tab.document.body.textContent = t('staffTraining.task.opening');
    } catch { /* a blank tab we cannot write to is still a tab */ }
    try {
      const { url } = await openTask(task.id);
      if (tab) {
        tab.opener = null;
        tab.location.replace(url);
      } else if (!window.open(url, '_blank', 'noopener')) {
        setBlockedUrl(url);
      }
    } catch (e) {
      tab?.close();
      setError(errorText(e, t));
    } finally {
      setOpening(false);
    }
  };

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      const next = await checkTask(task.id);
      setResult({ status: next.status, message: next.message, details: next.details, checked_at: next.checked_at });
      onChecked(next);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setChecking(false);
      setCooling(true);
      timer.current = window.setTimeout(() => setCooling(false), CHECK_COOLDOWN_MS);
    }
  };

  const reset = async () => {
    setConfirmReset(false);
    try {
      await resetPractice(task.id);
      setResult(null);
      toast(t('staffTraining.task.resetDone'), 'success');
    } catch (e) {
      setError(errorText(e, t));
    }
  };

  const checks = result?.details?.checks ?? [];
  const body = pick(task.body, locale);

  return (
    <div className="@container space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm @lg:p-6">
        <p className="rounded-lg bg-brand-subtle/50 px-3 py-2 text-xs text-foreground/80">{t(task.platform === 'crm' ? 'staffTraining.task.copy.crm' : 'staffTraining.task.copy.lms')}</p>
        <div className="mt-4 text-sm leading-relaxed text-foreground/90" data-task-body>
          {body ? <RichText source={body} /> : <p className="text-muted-foreground">{t('staffTraining.task.noBody')}</p>}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={open} disabled={opening}>
            {opening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <ExternalLink className="mr-2 h-4 w-4" aria-hidden />}
            {opening ? t('staffTraining.task.opening') : t('staffTraining.task.open')}
          </Button>
          <Button variant="outline" onClick={check} disabled={checking || cooling}>
            {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {checking ? t('staffTraining.task.checking') : t('staffTraining.task.check')}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmReset(true)} className="text-muted-foreground">
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
            {t('staffTraining.task.reset')}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t('staffTraining.task.openHint')}</p>
        <p className="mt-1 text-xs text-muted-foreground" data-task-names-note>{t('staffTraining.task.namesNote')}</p>
        {blockedUrl && (
          <p className="mt-3 text-sm text-foreground">
            {t('staffTraining.task.blocked')}{' '}
            <a href={blockedUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">{t('staffTraining.task.open')}</a>
          </p>
        )}
      </div>

      {result && (
        <section
          role="status"
          data-task-result={result.status}
          className={cn(
            'rounded-2xl border p-4 @lg:p-5',
            result.status === 'passed' && 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100',
            result.status === 'failed' && 'border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100',
            result.status === 'error' && 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100',
          )}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            {result.status === 'passed' ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : result.status === 'failed' ? <XCircle className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
            {t(`staffTraining.task.status.${result.status}`)}
            <span className="ml-auto text-xs font-normal opacity-75">{t('staffTraining.task.checkedAt', { time: formatDateTime(result.checked_at, undefined, locale) })}</span>
          </p>
          <p data-task-message className="mt-2 text-base">{pick(result.message, locale)}</p>
          {result.status === 'error' && <p className="mt-1 text-sm opacity-90">{t('staffTraining.task.errorHint')}</p>}
          {checks.length > 1 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {checks.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  {item.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                  <span>{item[locale] || item.ru || item.en}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {error && <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">{error}</p>}
      {done && !result && <p className="text-sm text-emerald-700 dark:text-emerald-400">{t('staffTraining.task.done')}</p>}

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('staffTraining.task.resetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('staffTraining.task.resetBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={reset}>{t('staffTraining.task.reset')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
