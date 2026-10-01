import { useState } from 'react';
import { ChevronDown, Eye, Lock, MoreVertical, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import MaterialRow from '../class-materials/MaterialRow';
import LibraryItemMenu from './LibraryItemMenu';
import LibraryAddMenu from './LibraryAddMenu';
import { SectionNameDialog, ShareGroupsDialog } from './SectionDialogs';
import type { MaterialItem } from '../../services/api/classMaterials';
import {
  archiveLibrarySection, libraryErrorText, openLibraryItem, reorderLibraryItems, setLibrarySectionGroups,
  unshareLibrarySection, updateLibrarySection,
  type LibrarySection,
} from '../../services/api/library';
import { plural, t, type Locale } from '../../lib/classMaterials';
import { moveId, toMaterialItem } from '../../lib/library';

interface Props {
  section: LibrarySection;
  locale: Locale;
  onOpenItem: (item: MaterialItem) => void;
  onChanged: () => void;
  defaultOpen?: boolean;
  /** Reordering among the sections of its space — absent where the viewer can't reorder. */
  onMove?: (direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /** A teacher section's share picker: the owner's groups (from `/mine`). */
  shareableGroups?: { id: number; name: string }[];
  /** Shown inside this group's block: offers «Убрать из этой группы» (its own teacher, or an admin). */
  unshareFromGroupId?: number;
}

/**
 * One section of the library (SPEC §9): a collapsible card with its rows, and — for whoever
 * manages it — rename, «Только для преподавателей» (program sections), «Поделиться с группами»
 * (teacher sections), move up/down and «Удалить раздел», plus «Добавить» under the rows.
 * Managers also see how many students opened each item.
 */
export default function SectionCard({
  section, locale, onOpenItem, onChanged, defaultOpen = true, onMove, canMoveUp, canMoveDown, shareableGroups,
  unshareFromGroupId,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [renameOpen, setRenameOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (err: unknown) => toast.error(libraryErrorText(err, locale));
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      onChanged();
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const visibleItems = section.items.filter((item) => !item.removed || item.can_moderate);
  const liveIds = section.items.filter((item) => !item.removed).map((item) => item.id);
  const isTeacherSection = section.scope === 'teacher';
  const sharedIds = section.shared_group_ids ?? [];
  const groupNames = new Map((shareableGroups ?? []).map((g) => [g.id, g.name]));
  const sharedNames = sharedIds.map((id) => groupNames.get(id)).filter((n): n is string => !!n);

  const moveItem = (id: number, direction: -1 | 1) => {
    const next = moveId(liveIds, id, direction);
    if (next) void run(() => reorderLibraryItems(section.id, next));
  };

  const count = plural(visibleItems.length, locale, ['материал', 'материала', 'материалов'], ['item', 'items']);

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm" aria-labelledby={`library-section-${section.id}`}>
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t('collapse', locale) : t('expand', locale)}
          className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className={`h-4 w-4 flex-none text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden />
          <span className="min-w-0 flex-1">
            <span id={`library-section-${section.id}`} className="block break-words text-sm font-semibold text-foreground">
              {section.title}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{count}</span>
              {section.teachers_only && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  <Lock className="h-3 w-3" aria-hidden />
                  {t('teachersOnlyChip', locale)}
                </span>
              )}
              {isTeacherSection && section.shared_group_ids != null && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <Users className="h-3 w-3 flex-none" aria-hidden />
                  <span className="truncate">
                    {sharedIds.length === 0
                      ? t('notShared', locale)
                      : `${t('sharedWith', locale)}: ${sharedNames.length ? sharedNames.join(', ') : sharedIds.length}`}
                  </span>
                </span>
              )}
            </span>
          </span>
        </button>

        {(section.can_manage || unshareFromGroupId != null) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('sectionActions', locale)}
                disabled={busy}
              >
                <MoreVertical className="h-4 w-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {unshareFromGroupId != null && (
                <DropdownMenuItem onSelect={() => void run(() => unshareLibrarySection(section.id, unshareFromGroupId))}>
                  {t('removeFromGroup', locale)}
                </DropdownMenuItem>
              )}
              {section.can_manage && unshareFromGroupId != null && <DropdownMenuSeparator />}
              {section.can_manage && <DropdownMenuItem onSelect={() => setRenameOpen(true)}>{t('rename', locale)}</DropdownMenuItem>}
              {section.can_manage && section.scope === 'program' && (
                <DropdownMenuCheckboxItem
                  checked={section.teachers_only}
                  onCheckedChange={() => void run(() => updateLibrarySection(section.id, { teachers_only: !section.teachers_only }))}
                >
                  {t('teachersOnly', locale)}
                </DropdownMenuCheckboxItem>
              )}
              {section.can_manage && isTeacherSection && shareableGroups && (
                <DropdownMenuItem onSelect={() => setShareOpen(true)}>{t('shareWithGroups', locale)}</DropdownMenuItem>
              )}
              {section.can_manage && onMove && canMoveUp && <DropdownMenuItem onSelect={() => onMove(-1)}>{t('moveUp', locale)}</DropdownMenuItem>}
              {section.can_manage && onMove && canMoveDown && <DropdownMenuItem onSelect={() => onMove(1)}>{t('moveDown', locale)}</DropdownMenuItem>}
              {section.can_manage && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-destructive focus:text-destructive">
                    {t('deleteSection', locale)}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {open && (
        <div className="space-y-2 border-t border-border px-3 pb-3 pt-1">
          {visibleItems.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">{t('sectionEmpty', locale)}</p>
          ) : (
            <div className="divide-y divide-border">
              {visibleItems.map((item) => {
                const index = liveIds.indexOf(item.id);
                const canReorder = section.can_manage && index !== -1;
                return (
                  <MaterialRow
                    key={item.id}
                    item={toMaterialItem(item)}
                    locale={locale}
                    density="comfortable"
                    openItem={openLibraryItem}
                    onOpen={onOpenItem}
                    meta={item.open_count != null && !item.removed ? (
                      <span className="inline-flex flex-none items-center gap-0.5 text-xs text-muted-foreground" title={t('opensCount', locale)}>
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        {item.open_count}
                      </span>
                    ) : undefined}
                    actions={(
                      <LibraryItemMenu
                        item={item}
                        locale={locale}
                        onChanged={onChanged}
                        onMove={canReorder ? (direction) => moveItem(item.id, direction) : undefined}
                        canMoveUp={canReorder && index > 0}
                        canMoveDown={canReorder && index < liveIds.length - 1}
                      />
                    )}
                  />
                );
              })}
            </div>
          )}
          {section.can_manage && <LibraryAddMenu sectionId={section.id} locale={locale} onChanged={onChanged} />}
        </div>
      )}

      <SectionNameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        locale={locale}
        initialTitle={section.title}
        onSubmit={async ({ title }) => {
          await updateLibrarySection(section.id, { title });
          onChanged();
        }}
      />
      {isTeacherSection && (
        <ShareGroupsDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          locale={locale}
          groups={shareableGroups ?? []}
          selected={sharedIds}
          onSave={async (groupIds) => {
            await setLibrarySectionGroups(section.id, groupIds);
            onChanged();
          }}
        />
      )}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteSection', locale)}</AlertDialogTitle>
            <AlertDialogDescription>
              «{section.title}». {t('deleteSectionHint', locale)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('cancel', locale)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void run(() => archiveLibrarySection(section.id)).then((ok) => ok && setConfirmDelete(false));
              }}
              disabled={busy}
            >
              {t('deleteSection', locale)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
