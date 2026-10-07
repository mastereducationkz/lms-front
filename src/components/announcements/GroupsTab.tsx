import { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from '../Toast';
import { GroupFilterBar, ProgramBadges, useGroupFilters } from './GroupFilters';
import { GROUP_STATUS_LABELS, GROUP_STATUS_STYLES, errorMessage } from './shared';
import { setGroupStatus } from '../../services/api/announcements';
import type { TelegramGroup } from '../../services/api/announcements';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/announcements';

interface GroupsTabProps {
  groups: TelegramGroup[];
  loading: boolean;
  onChanged: () => void;
}

function BotMembership({ group }: { group: TelegramGroup }) {
  const t = useT();
  if (!group.is_active) return <span className="text-rose-600">{t('announcements.groups.removed')}</span>;
  if (group.bot_is_admin) return <span className="text-muted-foreground">{t('announcements.groups.admin')}</span>;
  return (
    <span className="text-muted-foreground" title={t('announcements.groups.cannotPin')}>
      {t('announcements.groups.member')}
    </span>
  );
}

/**
 * Every group the bot has been discovered in, and the approval that gates it.
 *
 * Uses the same filters as the composer's recipient picker, but over EVERY
 * group — pending, approved, rejected and removed alike — so finding a group to
 * approve works the same way as finding one to send to.
 */
export function GroupsTab({ groups, loading, onChanged }: GroupsTabProps) {
  const t = useT();
  const [busyId, setBusyId] = useState<number | null>(null);
  const filters = useGroupFilters(groups);
  const { visibleGroups } = filters;

  const update = async (group: TelegramGroup, status: 'approved' | 'rejected') => {
    setBusyId(group.id);
    try {
      await setGroupStatus(group.id, status);
      toast(status === 'approved' ? t('announcements.groups.approved') : t('announcements.groups.rejected'), 'success');
      onChanged();
    } catch (error) {
      toast(errorMessage(error, t('announcements.groups.updateFailed')), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const messageRow = (content: React.ReactNode) => (
    <TableRow>
      <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
        {content}
      </TableCell>
    </TableRow>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('announcements.groups.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('announcements.groups.introBefore')} <code>/register</code> {t('announcements.groups.introAfter')}
        </p>
        {groups.length > 0 && (
          <div className="pt-3">
            <GroupFilterBar filters={filters} />
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('announcements.groups.colGroup')}</TableHead>
                <TableHead>{t('announcements.groups.colStatus')}</TableHead>
                <TableHead>{t('announcements.groups.colBot')}</TableHead>
                <TableHead>{t('announcements.groups.colApprovedBy')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && groups.length === 0
                ? messageRow(t('common.loading'))
                : groups.length === 0
                  ? messageRow(t('announcements.groups.empty'))
                  : visibleGroups.length === 0
                    ? messageRow(
                        <>
                          {t('announcements.filters.noMatch')}{' '}
                          <button
                            type="button"
                            onClick={filters.clearFilters}
                            className="font-medium text-primary hover:underline"
                          >
                            {t('announcements.filters.clear')}
                          </button>
                        </>,
                      )
                    : visibleGroups.map((group) => (
                        <TableRow key={group.id}>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium text-foreground">
                                {group.title || t('announcements.groups.untitled')}
                              </span>
                              <ProgramBadges programs={filters.programsOf(group)} />
                            </div>
                            <div className="text-xs text-muted-foreground">{group.telegram_chat_id}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={GROUP_STATUS_STYLES[group.status]}>
                              {t(GROUP_STATUS_LABELS[group.status])}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <BotMembership group={group} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {group.approved_by_email || '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {group.status !== 'approved' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mr-2"
                                onClick={() => update(group, 'approved')}
                                // A departed bot can't deliver, so approving it
                                // would promise a recipient that doesn't exist.
                                disabled={busyId === group.id || !group.is_active}
                              >
                                {t('announcements.groups.approve')}
                              </Button>
                            )}
                            {group.status !== 'rejected' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => update(group, 'rejected')}
                                disabled={busyId === group.id}
                              >
                                {t('announcements.groups.reject')}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
