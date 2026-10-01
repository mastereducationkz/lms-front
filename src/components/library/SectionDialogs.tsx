import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { libraryErrorText } from '../../services/api/library';
import { t, type Locale } from '../../lib/classMaterials';

interface NameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  /** «Новый раздел» when absent, rename otherwise. */
  initialTitle?: string;
  /** Program sections only: the «Только для преподавателей» box on create. */
  offerTeachersOnly?: boolean;
  onSubmit: (value: { title: string; teachers_only: boolean }) => Promise<void>;
}

/** Create or rename a section: one title (≤120), plus «Только для преподавателей» when creating in a program. */
export function SectionNameDialog({ open, onOpenChange, locale, initialTitle, offerTeachersOnly, onSubmit }: NameProps) {
  const [title, setTitle] = useState(initialTitle ?? '');
  const [teachersOnly, setTeachersOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const creating = initialTitle === undefined;

  useEffect(() => {
    if (open) {
      setTitle(initialTitle ?? '');
      setTeachersOnly(false);
    }
  }, [open, initialTitle]);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSubmit({ title: trimmed, teachers_only: teachersOnly });
      onOpenChange(false);
    } catch (err) {
      toast.error(libraryErrorText(err, locale));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{creating ? t('newSection', locale) : t('rename', locale)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="library-section-title">{t('sectionName', locale)}</Label>
            <Input
              id="library-section-title"
              value={title}
              maxLength={120}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
            />
          </div>
          {creating && offerTeachersOnly && (
            <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox checked={teachersOnly} onCheckedChange={(v) => setTeachersOnly(v === true)} className="mt-0.5" />
              <span>
                <span className="font-medium text-foreground">{t('teachersOnly', locale)}</span>
                <span className="block text-xs text-muted-foreground">{t('teachersOnlyHint', locale)}</span>
              </span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('cancel', locale)}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving || !title.trim()}>
            {creating ? t('create', locale) : t('save', locale)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ShareProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  groups: { id: number; name: string }[];
  selected: number[];
  onSave: (groupIds: number[]) => Promise<void>;
}

/** «Поделиться с группами»: the teacher's own groups as a checklist; saving sends the full list. */
export function ShareGroupsDialog({ open, onOpenChange, locale, groups, selected, onSave }: ShareProps) {
  const [picked, setPicked] = useState<Set<number>>(new Set(selected));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setPicked(new Set(selected));
    // `selected` is a fresh array each render; the dialog only re-seeds when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      // Shares outside the caller's own groups (an admin's, or a group that changed teacher) are kept.
      await onSave(Array.from(picked));
      onOpenChange(false);
    } catch (err) {
      toast.error(libraryErrorText(err, locale));
    } finally {
      setSaving(false);
    }
  };

  const sorted = groups.slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('shareWithGroups', locale)}</DialogTitle>
        </DialogHeader>
        {sorted.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t('noShareableGroups', locale)}</p>
        ) : (
          <div className="max-h-[50vh] space-y-0.5 overflow-y-auto">
            {sorted.map((g) => (
              <label key={g.id} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-md px-1 text-sm hover:bg-muted/50">
                <Checkbox checked={picked.has(g.id)} onCheckedChange={() => toggle(g.id)} />
                <span className="min-w-0 flex-1 break-words text-foreground">{g.name}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('cancel', locale)}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || sorted.length === 0}>
            {t('save', locale)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
