import { useCallback, useEffect, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { getAlertState, sendAlertTest, setAlertRecipients, type AlertState } from '../../../services/api/questionReportAlerts';
import { roleLabel } from '@/lib/roleLabel';
import { useT } from '../../../lib/i18n/react';
import '@/lib/i18n/catalogs/adminPages';

/**
 * «Telegram alerts» on the question-reports page: who is told about a new report as a personal Telegram message,
 * besides the chat IDs set on the server. Adding someone is a click; they connect their own Telegram in Settings.
 */
export default function AlertRecipients() {
  const t = useT();
  const [state, setState] = useState<AlertState | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(() => getAlertState().then(setState).catch(() => setFailed(true)), []);
  useEffect(() => { void load(); }, [load]);
  if (failed) return null;                                   // a head teacher who cannot manage it simply does not see it
  if (!state) return <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /></div>;

  const change = async (ids: number[]) => {
    setBusy(true); setNote(null);
    try { setState(await setAlertRecipients(ids)); setPick(''); } catch (failure) { setNote({ kind: 'error', text: failure instanceof Error ? failure.message : t('adminPages.questionReports.alerts.failed') }); } finally { setBusy(false); }
  };
  const test = async (userId: number) => {
    setNote(null);
    try {
      const { status } = await sendAlertTest(userId);
      setNote(status === 'sent' ? { kind: 'ok', text: t('adminPages.questionReports.alerts.testSent') } : { kind: 'error', text: t('adminPages.questionReports.alerts.testNotSent', { status }) });
    } catch (failure) { setNote({ kind: 'error', text: failure instanceof Error ? failure.message : t('adminPages.questionReports.alerts.failed') }); }
  };
  const ids = state.recipients.map((r) => r.user_id);
  const waiting = state.recipients.filter((r) => r.linked === false).length;

  return (
    <Card className="mb-4" data-alert-recipients>
      <CardContent className="p-4">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 text-left text-sm font-medium">
          <Bell className="h-4 w-4" aria-hidden />
          {t('adminPages.questionReports.alerts.title')}
          <span className="text-xs font-normal text-muted-foreground">
            {t('adminPages.questionReports.alerts.summary', { people: state.recipients.length, chats: state.server_chats })}
            {waiting > 0 && ` · ${t('adminPages.questionReports.alerts.waiting', { count: waiting })}`}
          </span>
        </button>
        {open && (
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">{t('adminPages.questionReports.alerts.help', { chats: state.server_chats })}</p>
            {state.recipients.length === 0 && <p className="text-sm text-muted-foreground">{t('adminPages.questionReports.alerts.none')}</p>}
            <ul className="divide-y divide-border">
              {state.recipients.map((r) => (
                <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium">{r.name}</span> <span className="text-muted-foreground">({roleLabel(r.role)})</span>
                    <span className={r.linked ? 'ml-2 text-xs text-green-700 dark:text-green-400' : 'ml-2 text-xs text-amber-700 dark:text-amber-400'} data-link={String(r.linked)}>
                      {r.linked === null ? t('adminPages.questionReports.alerts.unknown') : r.linked ? t('adminPages.questionReports.alerts.connected') : t('adminPages.questionReports.alerts.notConnected')}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    {r.linked && <Button type="button" variant="outline" size="sm" onClick={() => test(r.user_id)}>{t('adminPages.questionReports.alerts.test')}</Button>}
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => change(ids.filter((id) => id !== r.user_id))}>{t('adminPages.questionReports.alerts.remove')}</Button>
                  </span>
                </li>
              ))}
            </ul>
            {waiting > 0 && <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">{t('adminPages.questionReports.alerts.connectHint')}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label={t('adminPages.questionReports.alerts.addLabel')} value={pick} onChange={(e) => setPick(e.target.value)} className="h-9 min-w-[14rem] rounded-md border border-input bg-background px-3 text-sm">
                <option value="">{t('adminPages.questionReports.alerts.addPlaceholder')}</option>
                {state.candidates.map((c) => <option key={c.user_id} value={c.user_id}>{c.name} ({roleLabel(c.role)}){c.linked ? ' ✓' : ''}</option>)}
              </select>
              <Button type="button" size="sm" disabled={busy || !pick} onClick={() => change([...ids, Number(pick)])}>{t('adminPages.questionReports.alerts.add')}</Button>
            </div>
            {note && <p role={note.kind === 'error' ? 'alert' : 'status'} className={note.kind === 'error' ? 'text-sm text-red-600 dark:text-red-400' : 'text-sm text-green-700 dark:text-green-400'}>{note.text}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
