import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, Search, Unlink } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { SearchableSelect } from '../ui/searchable-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from '../Toast';
import { formatDateTime, type MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import { DELIVERY_STATUS_LABELS, errorMessage } from './shared';
import { InvitationChatsView } from './InvitationChatsView';
import { GROUP_STATUS_LABEL, chatRows, isInactive } from './invitationChats';
import {
  confirmInvitationLinks, getInvitationLinks, setInvitationLink,
  type InvitationGroupRow, type InvitationLinks,
} from '../../services/api/announcements';
import '@/lib/i18n/catalogs/announcements';

type View = 'all' | 'suggested' | 'linked' | 'unlinked';

const LAST_STYLES: Record<string, string> = {
  sent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  skipped: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300',
  pending: 'bg-muted text-foreground/80',
};

function when(iso: string | null): string {
  return formatDateTime(iso);
}

/**
 * Which Telegram chat is which LMS group's — the setup behind lesson invitations.
 *
 * Five minutes before each lesson held in an LMS Meet room, the bot posts the invitation (the
 * lesson card's "Скопировать приглашение" text) to the group's chat. The server suggests a
 * chat for each group by name; a person confirms it, one by one or all at once.
 */
export function LessonInvitationsTab() {
  const t = useT();
  const [data, setData] = useState<InvitationLinks | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | 'all' | null>(null);
  const [view, setView] = useState<View>('all');
  const [query, setQuery] = useState('');
  // Two ways to read the same links: from the LMS side, or from Telegram's.
  const [mode, setMode] = useState<'groups' | 'chats'>('groups');
  // Stopped and finished groups have nothing left to invite; they are listed when asked for (and
  // always when they are linked, so a link can be seen and removed).
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getInvitationLinks());
    } catch (error) {
      toast(errorMessage(error, t('announcements.invitations.loadFailed')), 'error');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const allGroups = data?.groups ?? [];
  const hiddenInactive = allGroups.filter((g) => isInactive(g) && !g.link).length;
  const groups = useMemo(
    () => (showInactive ? allGroups : allGroups.filter((g) => !isInactive(g) || g.link)),
    [allGroups, showInactive],
  );
  const counts = useMemo(() => ({
    all: groups.length,
    suggested: groups.filter((g) => !g.link && g.suggestion).length,
    linked: groups.filter((g) => g.link).length,
    unlinked: groups.filter((g) => !g.link && !g.suggestion).length,
  }), [groups]);

  const visible = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return groups.filter((g) => {
      if (view === 'suggested' && !(g.suggestion && !g.link)) return false;
      if (view === 'linked' && !g.link) return false;
      if (view === 'unlinked' && (g.link || g.suggestion)) return false;
      const hay = `${g.name} ${g.link?.chat_title ?? ''} ${g.suggestion?.chat_title ?? ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [groups, view, query]);

  const chatOptions = useMemo(
    () => (data?.chats ?? []).map((c) => ({ value: String(c.id), label: c.title })),
    [data],
  );
  const readOnly = !!data?.chats_error;

  const saveLink = async (groupId: number, groupName: string, chatId: number | null) => {
    setBusy(groupId);
    try {
      await setInvitationLink(groupId, chatId);
      toast(t(chatId === null ? 'announcements.invitations.unlinked' : 'announcements.invitations.linked', { name: groupName }), 'success');
      await load();
    } catch (error) {
      toast(errorMessage(error, t('announcements.invitations.saveFailed')), 'error');
    } finally {
      setBusy(null);
    }
  };
  const link = (row: InvitationGroupRow, chatId: number | null) => saveLink(row.id, row.name, chatId);
  const chatsWithoutGroup = useMemo(
    () => (data ? chatRows(data).filter((r) => r.groups.length === 0).length : 0),
    [data],
  );

  const confirmAll = async () => {
    const pairs = groups
      .filter((g) => !g.link && g.suggestion)
      .map((g) => ({ lms_group_id: g.id, support_group_id: g.suggestion!.chat_id }));
    if (!pairs.length) return;
    setBusy('all');
    try {
      const n = await confirmInvitationLinks(pairs);
      toast(t('announcements.invitations.linkedCount', { count: n }), 'success');
      await load();
    } catch (error) {
      toast(errorMessage(error, t('announcements.invitations.confirmFailed')), 'error');
    } finally {
      setBusy(null);
    }
  };

  const picker = (row: InvitationGroupRow, placeholder: string) => (
    <SearchableSelect
      options={chatOptions}
      value={row.link ? String(row.link.chat_id) : null}
      onChange={(v) => void link(row, Number(v))}
      placeholder={placeholder}
      searchPlaceholder={t('announcements.invitations.searchChats')}
      emptyText={t('announcements.invitations.noChatMatches')}
      disabled={readOnly || busy !== null}
      className="h-8 w-44 text-xs"
    />
  );

  const VIEWS: { key: View; label: MessageKey }[] = [
    { key: 'all', label: 'common.all' },
    { key: 'suggested', label: 'announcements.invitations.viewSuggested' },
    { key: 'linked', label: 'announcements.invitations.viewLinked' },
    { key: 'unlinked', label: 'announcements.invitations.viewNoChat' },
  ];

  return (
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div>
          <CardTitle className="text-base">{t('announcements.invitations.title')}</CardTitle>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t('announcements.invitations.intro')}
          </p>
        </div>

        {data && (
          <div
            className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${data.enabled
              ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200'
              : 'bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200'}`}
          >
            {data.enabled ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" /> : <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />}
            <span>
              {data.enabled
                ? t('announcements.invitations.enabled')
                : t('announcements.invitations.disabled')}
            </span>
          </div>
        )}
        {readOnly && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-900/20 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span>{t('announcements.invitations.botUnreachable', { error: data?.chats_error ?? '' })}</span>
          </div>
        )}

        <div className="inline-flex gap-0.5 self-start rounded-lg border border-border bg-muted/40 p-0.5" role="tablist" aria-label={t('announcements.invitations.viewBy')}>
          {([
            { key: 'groups', label: 'announcements.invitations.byGroup', count: null },
            { key: 'chats', label: 'announcements.invitations.byChat', count: chatsWithoutGroup },
          ] as const).map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => setMode(m.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${mode === m.key
                ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t(m.label)}
              {m.count ? (
                <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold tabular-nums text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                      title={t('announcements.invitations.chatsWithoutGroup')}>
                  {m.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {mode === 'groups' && (
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="invitation-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('announcements.invitations.search')}
              aria-label={t('announcements.invitations.search')}
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label={t('announcements.invitations.show')}>
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                aria-pressed={view === v.key}
                className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition ${view === v.key
                  ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t(v.label)} <span className="tabular-nums text-muted-foreground">{counts[v.key]}</span>
              </button>
            ))}
          </div>
          {(hiddenInactive > 0 || showInactive) && (
            <button
              type="button"
              onClick={() => setShowInactive((v) => !v)}
              aria-pressed={showInactive}
              className="rounded-md px-2 py-1 text-[13px] font-medium text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
            >
              {showInactive
                ? t('announcements.invitations.hideInactive')
                : t('announcements.invitations.showInactive', { count: hiddenInactive })}
            </button>
          )}
          {counts.suggested > 0 && !readOnly && (
            <Button size="sm" className="ml-auto gap-1.5" onClick={confirmAll} disabled={busy !== null}>
              <Link2 className="h-4 w-4" />
              {t('announcements.invitations.confirmAll', { count: counts.suggested })}
            </Button>
          )}
        </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {mode === 'chats' && data ? (
          <InvitationChatsView data={data} busy={busy !== null} readOnly={readOnly} onLink={saveLink} />
        ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('announcements.invitations.colGroup')}</TableHead>
                <TableHead>{t('announcements.invitations.colChat')}</TableHead>
                <TableHead>{t('announcements.invitations.colLast')}</TableHead>
                <TableHead className="text-right">{t('announcements.invitations.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
              ) : visible.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  {groups.length === 0 ? t('announcements.invitations.noGroups') : t('announcements.invitations.noGroupsMatch')}
                </TableCell></TableRow>
              ) : visible.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {row.name}
                      {row.status && row.status !== 'running' && (
                        <Badge variant="secondary"
                               className={row.status === 'not_started'
                                 ? 'bg-sky-100 font-normal text-sky-800 dark:bg-sky-900/30 dark:text-sky-300'
                                 : 'bg-muted font-normal text-muted-foreground'}
                               title={row.status === 'not_started'
                                 ? t('announcements.invitations.notStartedHint')
                                 : t('announcements.invitations.notRunningHint')}>
                          {t(GROUP_STATUS_LABEL[row.status])}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.link ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-foreground">{row.link.chat_title || t('announcements.invitations.chatFallback', { id: row.link.chat_id })}</span>
                        {row.link.chat_available === false && (
                          <Badge variant="secondary" className={LAST_STYLES.failed}>{t('announcements.invitations.chatUnavailable')}</Badge>
                        )}
                      </div>
                    ) : row.suggestion ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-muted-foreground">{t('announcements.invitations.suggested')}</span>
                        <span className="text-foreground">{row.suggestion.chat_title}</span>
                        <Badge variant="outline" className="font-normal tabular-nums">{t('announcements.invitations.match', { percent: Math.round(row.suggestion.score * 100) })}</Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t('announcements.invitations.viewNoChat')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.last_invitation ? (
                      <div className="flex flex-wrap items-center gap-1.5" title={row.last_invitation.error ?? undefined}>
                        <Badge variant="secondary" className={LAST_STYLES[row.last_invitation.status]}>
                          {DELIVERY_STATUS_LABELS[row.last_invitation.status] ? t(DELIVERY_STATUS_LABELS[row.last_invitation.status]) : row.last_invitation.status}
                        </Badge>
                        <span className="tabular-nums text-muted-foreground">{when(row.last_invitation.at)}</span>
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {!row.link && row.suggestion && (
                        <Button size="sm" variant="outline" className="h-8" disabled={readOnly || busy !== null}
                                onClick={() => void link(row, row.suggestion!.chat_id)}>
                          {t('announcements.invitations.confirm')}
                        </Button>
                      )}
                      {picker(row, row.link
                        ? t('announcements.invitations.changeChat')
                        : row.suggestion ? t('announcements.invitations.chooseAnother') : t('announcements.invitations.chooseChat'))}
                      {row.link && (
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" disabled={readOnly || busy !== null}
                                onClick={() => void link(row, null)} aria-label={t('announcements.invitations.unlink', { name: row.name })}>
                          <Unlink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
