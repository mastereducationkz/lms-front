import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import RemoveReasonDialog from '../class-materials/RemoveReasonDialog';
import {
  detachLibraryItem, libraryErrorText, moderateRemoveLibraryItem, updateLibraryItem, type LibraryItem,
} from '../../services/api/library';
import { t, type Locale } from '../../lib/classMaterials';

interface Props {
  item: LibraryItem;
  locale: Locale;
  onChanged: () => void;
  /** Present when the viewer may reorder this section; `null` direction = already at that end. */
  onMove?: (direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

/**
 * The ⋯ menu of one library row (SPEC §9): move up/down and rename a link for whoever manages the
 * section, «Убрать из раздела» for them too, and removal with a reason for moderators — the reason
 * is what the uploader's bell says. Nothing to show → no button at all.
 */
export default function LibraryItemMenu({ item, locale, onChanged, onMove, canMoveUp, canMoveDown }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [moderateOpen, setModerateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (err: unknown) => toast.error(libraryErrorText(err, locale));
  const canRename = item.can_remove && item.kind === 'link';
  const canMove = !!onMove && (canMoveUp || canMoveDown);
  if (item.removed || (!canRename && !item.can_remove && !item.can_moderate && !canMove)) return null;

  const saveRename = async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === item.title) {
      setRenaming(false);
      setTitle(item.title);
      return;
    }
    setBusy(true);
    try {
      await updateLibraryItem(item.id, { link_title: trimmed });
      setRenaming(false);
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await detachLibraryItem(item.id);
      setConfirmRemove(false);
      onChanged();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  if (renaming) {
    return (
      <div className="flex flex-none items-center gap-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          autoFocus
          className="h-9 w-36 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void saveRename();
            if (e.key === 'Escape') {
              setRenaming(false);
              setTitle(item.title);
            }
          }}
        />
        <Button type="button" size="sm" className="h-9 flex-none px-3" onClick={() => void saveRename()} disabled={busy}>
          {t('save', locale)}
        </Button>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t('moreActions', locale)}
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onMove && canMoveUp && <DropdownMenuItem onSelect={() => onMove(-1)}>{t('moveUp', locale)}</DropdownMenuItem>}
          {onMove && canMoveDown && <DropdownMenuItem onSelect={() => onMove(1)}>{t('moveDown', locale)}</DropdownMenuItem>}
          {canRename && <DropdownMenuItem onSelect={() => setRenaming(true)}>{t('rename', locale)}</DropdownMenuItem>}
          {item.can_remove && (
            <DropdownMenuItem onSelect={() => setConfirmRemove(true)} className="text-destructive focus:text-destructive">
              {t('removeFromSection', locale)}
            </DropdownMenuItem>
          )}
          {item.can_moderate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setModerateOpen(true)} className="text-destructive focus:text-destructive">
                {t('moderate', locale)}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeFromSection', locale)}</AlertDialogTitle>
            <AlertDialogDescription>{item.title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('cancel', locale)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
              disabled={busy}
            >
              {t('removeFromSection', locale)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RemoveReasonDialog
        open={moderateOpen}
        onOpenChange={setModerateOpen}
        itemId={item.id}
        locale={locale}
        remove={moderateRemoveLibraryItem}
        onRemoved={() => {
          setModerateOpen(false);
          onChanged();
        }}
      />
    </>
  );
}
