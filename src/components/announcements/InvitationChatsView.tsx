import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { SearchableSelect } from '../ui/searchable-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import type { InvitationLinks } from '../../services/api/announcements';
import { chatRows, groupOptionsFor } from './invitationChats';
import type { MessageKey } from '../../lib/i18n';
import { useLocale, useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/announcements';

type Filter = 'unlinked' | 'linked' | 'all';

interface Props {
  data: InvitationLinks;
  busy: boolean;
  readOnly: boolean;
  onLink: (groupId: number, groupName: string, chatId: number | null) => Promise<void>;
}

/**
 * The same links, seen from Telegram: which approved chats have no LMS group yet. Opens on those,
 * because that is what is left to do once the suggestions are confirmed.
 */
export function InvitationChatsView({ data, busy, readOnly, onLink }: Props) {
  const t = useT();
  const locale = useLocale();
  const [filter, setFilter] = useState<Filter>('unlinked');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => chatRows(data), [data]);
  const counts = {
    unlinked: rows.filter((r) => r.groups.length === 0).length,
    linked: rows.filter((r) => r.groups.length > 0).length,
    all: rows.length,
  };
  const visible = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (filter === 'unlinked' && r.groups.length) return false;
      if (filter === 'linked' && !r.groups.length) return false;
      const hay = `${r.chat.title} ${r.groups.map((g) => g.name).join(' ')}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [rows, filter, query]);

  // Every LMS group can be chosen — see groupOptionsFor for the order and the hints.
  const groupOptions = useMemo(() => groupOptionsFor(data.groups, locale), [data.groups, locale]);
  const nameOf = (id: number) => data.groups.find((g) => g.id === id)?.name ?? t('announcements.chats.groupFallback', { id });

  const FILTERS: { key: Filter; label: MessageKey }[] = [
    { key: 'unlinked', label: 'announcements.chats.noGroup' },
    { key: 'linked', label: 'announcements.chats.linked' },
    { key: 'all', label: 'announcements.chats.all' },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 px-6 pb-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="invitation-chat-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('announcements.chats.search')}
            aria-label={t('announcements.chats.search')}
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label={t('announcements.chats.show')}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition ${filter === f.key
                ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t(f.label)} <span className="tabular-nums text-muted-foreground">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border-t border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('announcements.chats.colChat')}</TableHead>
              <TableHead>{t('announcements.chats.colGroup')}</TableHead>
              <TableHead className="text-right">{t('announcements.chats.colLink')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                  {filter === 'unlinked' && !query
                    ? t('announcements.chats.allLinked')
                    : t('announcements.chats.noMatch')}
                </TableCell>
              </TableRow>
            ) : visible.map(({ chat, groups }) => (
              <TableRow key={chat.id}>
                <TableCell className="font-medium text-foreground">{chat.title}</TableCell>
                <TableCell className="text-sm">
                  {groups.length === 0 ? (
                    <span className="text-muted-foreground">{t('announcements.chats.noGroup')}</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {groups.map((g) => (
                        <span key={g.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 py-0.5 pl-2 pr-1 text-[13px]">
                          {g.name}
                          <button
                            type="button"
                            onClick={() => void onLink(g.id, g.name, null)}
                            disabled={readOnly || busy}
                            aria-label={t('announcements.chats.unlink', { group: g.name, chat: chat.title })}
                            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <SearchableSelect
                      options={groupOptions}
                      value={null}
                      onChange={(v) => void onLink(Number(v), nameOf(Number(v)), chat.id)}
                      placeholder={groups.length ? t('announcements.chats.addAnother') : t('announcements.chats.chooseGroup')}
                      searchPlaceholder={t('announcements.chats.searchGroups')}
                      emptyText={t('announcements.chats.noGroupMatches')}
                      disabled={readOnly || busy}
                      className="h-8 w-48 text-xs"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
