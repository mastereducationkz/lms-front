import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, Search, Unlink } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { SearchableSelect } from '../ui/searchable-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from '../Toast';
import { errorMessage } from './shared';
import { InvitationChatsView } from './InvitationChatsView';
import { GROUP_STATUS_LABEL, chatRows, isInactive } from './invitationChats';
import {
  confirmInvitationLinks, getInvitationLinks, setInvitationLink,
  type InvitationGroupRow, type InvitationLinks,
} from '../../services/api/announcements';

type View = 'all' | 'suggested' | 'linked' | 'unlinked';

const LAST_STYLES: Record<string, string> = {
  sent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  skipped: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300',
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function when(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Which Telegram chat is which LMS group's — the setup behind lesson invitations.
 *
 * Five minutes before each lesson held in an LMS Meet room, the bot posts the invitation (the
 * lesson card's "Скопировать приглашение" text) to the group's chat. The server suggests a
 * chat for each group by name; a person confirms it, one by one or all at once.
 */
export function LessonInvitationsTab() {
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
      toast(errorMessage(error, 'Failed to load lesson invitation settings'), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

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
      toast(chatId === null ? `Unlinked ${groupName}` : `Linked ${groupName}`, 'success');
      await load();
    } catch (error) {
      toast(errorMessage(error, 'Failed to save the link'), 'error');
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
      toast(`Linked ${n} group${n === 1 ? '' : 's'}`, 'success');
      await load();
    } catch (error) {
      toast(errorMessage(error, 'Failed to confirm the suggestions'), 'error');
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
      searchPlaceholder="Search Telegram chats…"
      emptyText="No approved chat matches"
      disabled={readOnly || busy !== null}
      className="h-8 w-44 text-xs"
    />
  );

  const VIEWS: { key: View; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'suggested', label: 'Suggested' },
    { key: 'linked', label: 'Linked' },
    { key: 'unlinked', label: 'No chat' },
  ];

  return (
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div>
          <CardTitle className="text-base">Lesson invitations</CardTitle>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Five minutes before each lesson held in an LMS Meet room, the bot posts the invitation to the
            group's Telegram chat — the same text as the lesson card's «Скопировать приглашение». Link each
            group to its chat; matches are suggested by name for you to confirm.
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
                ? 'Invitations are on. Every linked group gets them for its LMS Meet lessons.'
                : 'Invitations are switched off. Links you confirm now take effect as soon as they are switched on.'}
            </span>
          </div>
        )}
        {readOnly && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-900/20 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span>Could not reach the Telegram bot ({data?.chats_error}). Links are shown but cannot be changed right now.</span>
          </div>
        )}

        <div className="inline-flex gap-0.5 self-start rounded-lg border border-border bg-muted/40 p-0.5" role="tablist" aria-label="View links by">
          {([
            { key: 'groups', label: 'By LMS group', count: null },
            { key: 'chats', label: 'By Telegram chat', count: chatsWithoutGroup },
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
              {m.label}
              {m.count ? (
                <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold tabular-nums text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                      title="Chats with no LMS group">
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
              placeholder="Search groups or chats"
              aria-label="Search groups or chats"
              className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Show">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                aria-pressed={view === v.key}
                className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition ${view === v.key
                  ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {v.label} <span className="tabular-nums text-muted-foreground">{counts[v.key]}</span>
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
              {showInactive ? 'Hide stopped & finished' : `Show stopped & finished (${hiddenInactive})`}
            </button>
          )}
          {counts.suggested > 0 && !readOnly && (
            <Button size="sm" className="ml-auto gap-1.5" onClick={confirmAll} disabled={busy !== null}>
              <Link2 className="h-4 w-4" />
              Confirm all suggestions ({counts.suggested})
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
                <TableHead>Group</TableHead>
                <TableHead>Telegram chat</TableHead>
                <TableHead>Last invitation</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              ) : visible.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  {groups.length === 0 ? 'No groups.' : 'No groups match.'}
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
                                 : 'bg-slate-100 font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300'}
                               title={row.status === 'not_started'
                                 ? 'Switched on, nobody enrolled yet — invitations start once it has students'
                                 : 'No invitations: the group is not running'}>
                          {GROUP_STATUS_LABEL[row.status]}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.link ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-foreground">{row.link.chat_title || `Chat ${row.link.chat_id}`}</span>
                        {row.link.chat_available === false && (
                          <Badge variant="secondary" className={LAST_STYLES.failed}>Not approved or bot removed</Badge>
                        )}
                      </div>
                    ) : row.suggestion ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-muted-foreground">Suggested:</span>
                        <span className="text-foreground">{row.suggestion.chat_title}</span>
                        <Badge variant="outline" className="font-normal tabular-nums">{Math.round(row.suggestion.score * 100)}% match</Badge>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No chat</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.last_invitation ? (
                      <div className="flex flex-wrap items-center gap-1.5" title={row.last_invitation.error ?? undefined}>
                        <Badge variant="secondary" className={LAST_STYLES[row.last_invitation.status]}>{row.last_invitation.status}</Badge>
                        <span className="tabular-nums text-muted-foreground">{when(row.last_invitation.at)}</span>
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {!row.link && row.suggestion && (
                        <Button size="sm" variant="outline" className="h-8" disabled={readOnly || busy !== null}
                                onClick={() => void link(row, row.suggestion!.chat_id)}>
                          Confirm
                        </Button>
                      )}
                      {picker(row, row.link ? 'Change chat' : row.suggestion ? 'Choose another' : 'Choose a chat')}
                      {row.link && (
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground" disabled={readOnly || busy !== null}
                                onClick={() => void link(row, null)} aria-label={`Unlink ${row.name}`}>
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
