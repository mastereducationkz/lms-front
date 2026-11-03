import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Inbox as InboxIcon } from 'lucide-react';
import { Label } from '../../components/ui/label';
import { NativeSelect } from '../../components/ui/native-select';
import { Button } from '../../components/ui/button';
import { formatDateTime, type MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import { cn } from '../../lib/utils';
import {
  fetchInbox, fetchInboxMessage, type InboxMessage, type InboxMessageFull,
} from '../../services/api/trainingCopy';
import '@/lib/i18n/catalogs/trainingCopy';

const PAGE = 50;
const CHANNELS = ['email', 'support_bot', 'push', 'telegram', 'sms', 'whatsapp', 'amocrm', 'google', 'ai', 'http'] as const;
const KNOWN_CHANNELS: readonly string[] = CHANNELS;
const KNOWN_RECIPIENTS = ['parent', 'student', 'staff', 'group_chat', 'external', 'unknown'];

/** /inbox (training build only): everything the practice copy would have sent, so a task can show «this is what the parent receives». */
export default function InboxPage() {
  const t = useT();
  const [channel, setChannel] = useState('');
  const [items, setItems] = useState<InboxMessage[]>([]);
  const [more, setMore] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [selected, setSelected] = useState<InboxMessageFull | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  const load = useCallback(async (reset: boolean) => {
    if (reset) setState('loading');
    try {
      const before = reset ? undefined : items[items.length - 1]?.id;
      const rows = await fetchInbox({ channel: channel || undefined, before_id: before, limit: PAGE });
      setItems((prev) => (reset ? rows : [...prev, ...rows]));
      setMore(rows.length === PAGE);
      setState('ready');
    } catch {
      setState('failed');
    }
  }, [channel, items]);

  useEffect(() => { void load(true); setSelected(null); }, [channel]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (id: number) => {
    setOpening(id);
    try { setSelected(await fetchInboxMessage(id)); } catch { setState('failed'); } finally { setOpening(null); }
  };

  const label = (kind: 'channel' | 'recipient', value: string, known: readonly string[]) =>
    known.includes(value) ? t(`trainingCopy.inbox.${kind}.${value}` as MessageKey) : value;

  return (
    <div className="@container mx-auto w-full max-w-6xl space-y-4 p-4 @lg:p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <InboxIcon className="h-5 w-5" aria-hidden /> {t('trainingCopy.inbox.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('trainingCopy.inbox.subtitle')}</p>
      </header>

      <div className="max-w-xs space-y-1">
        <Label className="block text-xs" htmlFor="inbox-channel">{t('trainingCopy.inbox.channelLabel')}</Label>
        <NativeSelect id="inbox-channel" className="flex w-full" value={channel} onValueChange={setChannel}>
          <option value="">{t('trainingCopy.inbox.channel.all')}</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{label('channel', c, KNOWN_CHANNELS)}</option>)}
        </NativeSelect>
      </div>

      {state === 'failed' && (
        <div role="alert" className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {t('trainingCopy.inbox.loadFailed')}
          <Button size="sm" variant="outline" onClick={() => void load(true)}>{t('trainingCopy.inbox.retry')}</Button>
        </div>
      )}

      <div className="grid gap-4 @3xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-label={t('trainingCopy.inbox.title')} className={cn('space-y-2', selected && '@3xl:block hidden')}>
          {state === 'ready' && items.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t('trainingCopy.inbox.empty')}</p>
          )}
          <ul className="space-y-2">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => void open(m.id)}
                  disabled={opening === m.id}
                  aria-current={selected?.id === m.id}
                  className={cn('w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/60',
                    selected?.id === m.id && 'border-primary bg-primary/5')}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{label('channel', m.channel, KNOWN_CHANNELS)} · {label('recipient', m.recipient_kind, KNOWN_RECIPIENTS)}</span>
                    {m.created_at && <time dateTime={m.created_at}>{formatDateTime(m.created_at)}</time>}
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-foreground">{m.subject || t('trainingCopy.inbox.noSubject')}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.recipient_label}</div>
                </button>
              </li>
            ))}
          </ul>
          {more && <Button variant="outline" size="sm" className="w-full" onClick={() => void load(false)}>{t('trainingCopy.inbox.loadMore')}</Button>}
        </section>

        <section aria-live="polite" className={cn('min-w-0', !selected && 'hidden @3xl:block')}>
          {selected ? <Detail message={selected} onBack={() => setSelected(null)} t={t} label={label} />
            : <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{t('trainingCopy.inbox.pick')}</p>}
        </section>
      </div>
    </div>
  );
}

/** The message's HTML as a document of its own: a blob URL in an iframe with no permissions (nothing in it runs, it cannot reach this page). */
function useHtmlUrl(html: string | null): string | null {
  const url = useMemo(() => (html ? URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })) : null), [html]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

function Detail({ message, onBack, t, label }: {
  message: InboxMessageFull; onBack: () => void; t: ReturnType<typeof useT>;
  label: (kind: 'channel' | 'recipient', value: string, known: readonly string[]) => string;
}) {
  const htmlUrl = useHtmlUrl(message.body_html);
  return (
    <article className="space-y-3 rounded-lg border border-border bg-card p-4">
      <Button variant="ghost" size="sm" className="@3xl:hidden" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> {t('trainingCopy.inbox.back')}
      </Button>
      <h2 className="text-lg font-semibold text-foreground">{message.subject || t('trainingCopy.inbox.noSubject')}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t('trainingCopy.inbox.to')}</dt>
        <dd className="break-words">{message.recipient_label} ({label('recipient', message.recipient_kind, KNOWN_RECIPIENTS)})</dd>
        <dt className="text-muted-foreground">{label('channel', message.channel, KNOWN_CHANNELS)}</dt>
        <dd>{message.created_at ? formatDateTime(message.created_at) : ''} · {t(`trainingCopy.inbox.app.${message.source_app}` as MessageKey)}</dd>
      </dl>
      {htmlUrl ? (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{t('trainingCopy.inbox.html')}</div>
          {/* Sandboxed with no permissions: the message is rendered, never run. */}
          <iframe title={message.subject || String(message.id)} sandbox="" src={htmlUrl}
            className="h-96 w-full rounded-md border border-border bg-white" />
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">{t('trainingCopy.inbox.text')}</div>
          <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm">{message.body_text}</pre>
        </div>
      )}
    </article>
  );
}
