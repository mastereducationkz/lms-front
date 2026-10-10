import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Edit3, Repeat, Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { formatDateTime } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import type { Event } from '../../types';
import '@/lib/i18n/catalogs/adminPages';

export type SeriesScope = 'this' | 'following';

/**
 * «Only this event» / «This and all N following events» — the choice an edit or a cancel of a recurring webinar asks
 * for. Hidden when nothing follows (the last occurrence has no later weeks to carry the change to).
 */
export function SeriesScopePicker({ value, onChange, following, name = 'series-scope' }: {
  value: SeriesScope;
  onChange: (scope: SeriesScope) => void;
  /** Occurrences from this one on, this one included. */
  following: number;
  name?: string;
}) {
  const t = useT();
  if (following <= 1) return null;
  const options: [SeriesScope, string][] = [
    ['this', t('adminPages.events.series.scope.this')],
    ['following', t('adminPages.events.series.scope.following', { count: following - 1 })],
  ];
  return (
    <div role="radiogroup" className="space-y-1.5">
      {options.map(([scope, label]) => (
        <label key={scope} className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="radio" name={name} checked={value === scope} onChange={() => onChange(scope)} className="h-4 w-4 border-input text-brand focus:ring-brand" />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

/** Confirm cancelling an event of a series: only this one, or this and everything after it. */
export function SeriesDeleteDialog({ title, following, onConfirm, onClose, initialScope = 'this', busy = false }: {
  title: string;
  following: number;
  /** What is ticked when it opens: «Cancel upcoming…» on a series line starts on «this and following». */
  initialScope?: SeriesScope;
  onConfirm: (scope: SeriesScope) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const t = useT();
  const [scope, setScope] = useState<SeriesScope>(initialScope);
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('adminPages.events.series.cancelTitle')}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <SeriesScopePicker value={scope} onChange={setScope} following={following} name="series-cancel-scope" />
        <p className="text-xs text-muted-foreground">{t('adminPages.events.series.cancelHint')}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{t('adminPages.events.series.keep')}</Button>
          <Button type="button" variant="destructive" onClick={() => onConfirm(scope)} disabled={busy}>{t('adminPages.events.series.cancelConfirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One line for a whole recurring series in the events list; the weeks open underneath. */
export function SeriesRow({ title, total, upcoming, next, onEditNext, onCancelUpcoming, children }: {
  title: string;
  total: number;
  upcoming: number;
  next: Event;
  onEditNext: () => void;
  onCancelUpcoming: () => void;
  children: ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-3 p-4 hover:bg-muted dark:hover:bg-secondary transition-colors">
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {open ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-lg font-semibold text-foreground">{title}</span>
              <Badge variant="outline" className="text-brand border-brand-border"><Repeat className="mr-1 h-3 w-3" aria-hidden />{t('adminPages.events.series.badge')}</Badge>
            </span>
            <span className="block text-sm text-muted-foreground">
              {t('adminPages.events.series.counts', { upcoming, total })} · {t('adminPages.events.series.next', { date: formatDateTime(next.start_datetime, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) })}
            </span>
          </span>
        </button>
        <Button type="button" variant="outline" size="sm" onClick={onEditNext}><Edit3 className="mr-1.5 h-4 w-4" aria-hidden />{t('adminPages.events.series.editNext')}</Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancelUpcoming} className="text-red-600 dark:text-red-400"><Trash2 className="mr-1.5 h-4 w-4" aria-hidden />{t('adminPages.events.series.cancelUpcoming')}</Button>
      </div>
      {open && <div className="divide-y divide-border border-t bg-muted/20 pl-6">{children}</div>}
    </div>
  );
}
