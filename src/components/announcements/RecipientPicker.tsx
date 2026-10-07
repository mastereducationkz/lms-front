import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { GroupFilterBar, ProgramBadges, useGroupFilters } from './GroupFilters';
import type { RecipientSummary, TelegramGroup } from '../../services/api/announcements';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/announcements';

interface RecipientPickerProps {
  /** Groups that can receive an announcement: approved, with the bot still in them. */
  approvedGroups: TelegramGroup[];
  summary: RecipientSummary | null;
  selectedGroups: Set<number>;
  onSelectedGroupsChange: (next: Set<number>) => void;
  allStudents: boolean;
  onAllStudentsChange: (next: boolean) => void;
  /** Whether pinning is requested — groups where the bot can't pin get flagged. */
  pin: boolean;
}

/**
 * The Recipients card.
 *
 * Filtering only changes what is SHOWN. Selection is independent of it, so
 * narrowing to SAT, ticking two groups, then switching to IELTS keeps those two
 * ticked. The summary line says how many selected groups the current filters
 * hide, because the confirm dialog counts them even when they are off screen.
 */
export function RecipientPicker({
  approvedGroups,
  summary,
  selectedGroups,
  onSelectedGroupsChange,
  allStudents,
  onAllStudentsChange,
  pin,
}: RecipientPickerProps) {
  const t = useT();
  const filters = useGroupFilters(approvedGroups);
  const { visibleGroups, isFiltering } = filters;

  // Counted against the CURRENT approved list, not the raw selection, so a
  // group removed since the page loaded is never counted as a recipient.
  const selectedCount = approvedGroups.filter((group) => selectedGroups.has(group.id)).length;
  const visibleIds = useMemo(() => new Set(visibleGroups.map((g) => g.id)), [visibleGroups]);
  const hiddenSelectedCount = approvedGroups.filter(
    (group) => selectedGroups.has(group.id) && !visibleIds.has(group.id),
  ).length;
  const allVisibleSelected =
    visibleGroups.length > 0 && visibleGroups.every((group) => selectedGroups.has(group.id));

  const toggleGroup = (id: number) => {
    const next = new Set(selectedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedGroupsChange(next);
  };

  /** Select or deselect only what the filters show, leaving hidden picks alone. */
  const setVisibleSelected = (select: boolean) => {
    const next = new Set(selectedGroups);
    for (const group of visibleGroups) {
      if (select) next.add(group.id);
      else next.delete(group.id);
    }
    onSelectedGroupsChange(next);
  };

  const linkButtonClass = 'font-medium text-primary hover:underline';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('announcements.recipients.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {approvedGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('announcements.recipients.noneBefore')} <code>/register</code> {t('announcements.recipients.noneAfter')}
          </p>
        ) : (
          <div className="space-y-3">
            <GroupFilterBar filters={filters} />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-visible-groups"
                  checked={allVisibleSelected}
                  disabled={visibleGroups.length === 0}
                  onCheckedChange={(checked) => setVisibleSelected(checked === true)}
                />
                <Label htmlFor="select-visible-groups" className="cursor-pointer text-sm font-medium">
                  {isFiltering
                    ? t('announcements.recipients.selectShown', { count: visibleGroups.length })
                    : t('announcements.recipients.allGroups', { count: approvedGroups.length })}
                </Label>
              </div>
              {selectedCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {t('announcements.recipients.selected', { count: selectedCount })}
                    {hiddenSelectedCount > 0 && (
                      <span className="text-amber-600"> · {t('announcements.recipients.hiddenByFilters', { count: hiddenSelectedCount })}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectedGroupsChange(new Set())}
                    className={linkButtonClass}
                  >
                    {t('announcements.recipients.clear')}
                  </button>
                </div>
              )}
            </div>

            <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-md border border-border p-1.5">
              {visibleGroups.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {t('announcements.filters.noMatch')}{' '}
                  <button type="button" onClick={filters.clearFilters} className={linkButtonClass}>
                    {t('announcements.filters.clear')}
                  </button>
                </div>
              ) : (
                visibleGroups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={selectedGroups.has(group.id)}
                      onCheckedChange={() => toggleGroup(group.id)}
                    />
                    <Label
                      htmlFor={`group-${group.id}`}
                      className="flex-1 cursor-pointer truncate text-sm font-normal"
                    >
                      {group.title || group.telegram_chat_id}
                    </Label>
                    <ProgramBadges programs={filters.programsOf(group)} />
                    {pin && !group.bot_is_admin && (
                      <span className="shrink-0 text-xs text-amber-600" title={t('announcements.recipients.pinNeedsAdmin')}>
                        {t('announcements.recipients.cantPin')}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Checkbox
            id="all-students"
            checked={allStudents}
            onCheckedChange={(checked) => onAllStudentsChange(checked === true)}
          />
          <Label htmlFor="all-students" className="cursor-pointer text-sm font-normal">
            {t('announcements.recipients.allStudents', { count: summary?.students_opted_in ?? 0 })}
          </Label>
          {summary && summary.students_bound > summary.students_opted_in && (
            <span className="text-xs text-muted-foreground">
              {t('announcements.recipients.muted', { count: summary.students_bound - summary.students_opted_in })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
