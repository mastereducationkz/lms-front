import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  apiErrorCode, detachClassMaterialItem, restoreClassMaterialItem, updateClassFile,
  updateClassMaterialItem, type MaterialItem,
} from '../../services/api/classMaterials';
import { errorMessage, t, type Locale } from '../../lib/classMaterials';
import RemoveReasonDialog from './RemoveReasonDialog';

interface Props {
  item: MaterialItem;
  locale: Locale;
  /** Item mutations return only the one `MaterialItem`, never the full lesson payload, so this
   *  is always called with no argument — `ClassMaterialsSection` refetches the lesson. */
  onMutated: () => void;
}

/**
 * The ⋯ menu of one `MaterialRow` (§8.1/§8.4): rename (inline input), the after-class toggle
 * and detach for whoever can edit the item, and moderation (remove with a reason / restore)
 * for moderators. A removed item only ever offers restore.
 */
export default function ItemActionsMenu({ item, locale, onMutated }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [saving, setSaving] = useState(false);
  const [confirmDetach, setConfirmDetach] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (err: unknown) => toast.error(errorMessage(apiErrorCode(err), locale));

  const cancelRename = () => {
    setRenaming(false);
    setTitle(item.title);
  };

  const saveRename = async () => {
    const trimmed = title.trim();
    if (!trimmed || trimmed === item.title) {
      cancelRename();
      return;
    }
    setSaving(true);
    try {
      if (item.kind === 'file' && item.file) {
        await updateClassFile(item.file.id, { title: trimmed });
      } else {
        await updateClassMaterialItem(item.id, { link_title: trimmed });
      }
      setRenaming(false);
      onMutated();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const toggleAfterClass = async () => {
    setBusy(true);
    try {
      await updateClassMaterialItem(item.id, { show_after_end: !item.show_after_end });
      onMutated();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const detach = async () => {
    setBusy(true);
    try {
      await detachClassMaterialItem(item.id);
      setConfirmDetach(false);
      onMutated();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      await restoreClassMaterialItem(item.id);
      onMutated();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  if (item.removed) {
    if (!item.can_moderate) return null;
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 flex-none px-2 text-xs"
        onClick={() => void restore()}
        disabled={busy}
      >
        {t('restore', locale)}
      </Button>
    );
  }

  if (renaming) {
    return (
      <div className="flex flex-none items-center gap-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          autoFocus
          className="h-7 w-36 text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void saveRename();
            if (e.key === 'Escape') cancelRename();
          }}
        />
        <Button
          type="button"
          size="sm"
          className="h-7 flex-none px-2 text-xs"
          onClick={() => void saveRename()}
          disabled={saving}
        >
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
            className="flex-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t('rename', locale)}
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.can_edit && (
            <DropdownMenuItem onSelect={() => setRenaming(true)}>{t('rename', locale)}</DropdownMenuItem>
          )}
          {item.can_edit && (
            <DropdownMenuCheckboxItem checked={item.show_after_end} onCheckedChange={() => void toggleAfterClass()}>
              {t('showAfterClass', locale)}
            </DropdownMenuCheckboxItem>
          )}
          {item.can_detach && (
            <DropdownMenuItem
              onSelect={() => setConfirmDetach(true)}
              className="text-destructive focus:text-destructive"
            >
              {t('detach', locale)}
            </DropdownMenuItem>
          )}
          {item.can_moderate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setRemoveOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                {t('moderate', locale)}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDetach} onOpenChange={setConfirmDetach}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('detach', locale)}</AlertDialogTitle>
            <AlertDialogDescription>{item.title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('cancel', locale)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void detach();
              }}
              disabled={busy}
            >
              {t('detach', locale)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RemoveReasonDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        itemId={item.id}
        locale={locale}
        onRemoved={() => {
          setRemoveOpen(false);
          onMutated();
        }}
      />
    </>
  );
}
