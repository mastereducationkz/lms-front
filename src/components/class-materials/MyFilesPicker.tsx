import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { apiErrorCode, listMyClassFiles, updateClassFile, type ClassFile } from '../../services/api/classMaterials';
import { errorMessage, formatSize, t, type Locale } from '../../lib/classMaterials';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  onConfirm: (fileIds: number[]) => Promise<void>;
}

const SEARCH_DEBOUNCE_MS = 300;

/**
 * «Из моих файлов» (§8.1, D2): the teacher's own shelf, newest first, with a debounced search
 * and multi-select. Hiding a file here (`hidden: true`) only affects the shelf listing — it
 * stays attached wherever it already is.
 */
export default function MyFilesPicker({ open, onOpenChange, locale, onConfirm }: Props) {
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<ClassFile[]>([]);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const requestSeq = useRef(0);

  const load = async (q: string, beforeId?: number, append = false) => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setLoading(true);
    try {
      const res = await listMyClassFiles({ q: q || undefined, beforeId });
      if (seq !== requestSeq.current) return;
      setFiles((prev) => (append ? [...prev, ...res.items] : res.items));
      setNextBeforeId(res.next_before_id);
    } catch {
      if (seq === requestSeq.current && !append) setFiles([]);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  // Selection resets only when the dialog opens — NOT on every search keystroke, and NOT when
  // "Load more" replaces `files`. `selected` holds ids, not row objects, so a pick made before
  // refining the search (or before paging further) survives both: Confirm still attaches it
  // even if the current result page doesn't show that file anymore.
  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handle = setTimeout(() => {
      void load(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // Debounced on `query`; re-running only needs `open`/`query`, not `load`'s identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hide = async (id: number) => {
    try {
      await updateClassFile(id, { hidden: true });
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      toast.error(errorMessage(apiErrorCode(err), locale));
    }
  };

  const confirm = async () => {
    if (!selected.size) return;
    setSubmitting(true);
    try {
      await onConfirm(Array.from(selected));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(apiErrorCode(err), locale));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>{t('fromMyFiles', locale)}</DialogTitle>
        </DialogHeader>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search', locale)} />
        <div className="flex-1 overflow-y-auto">
          {!loading && files.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('myFilesEmpty', locale)}</p>
          )}
          <ul className="divide-y divide-border">
            {files.map((file) => (
              <li key={file.id} className="flex items-center gap-2.5 py-2">
                <Checkbox checked={selected.has(file.id)} onCheckedChange={() => toggle(file.id)} />
                <button type="button" onClick={() => toggle(file.id)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-medium text-foreground">{file.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{formatSize(file.size_bytes, locale)}</div>
                </button>
                <button
                  type="button"
                  onClick={() => void hide(file.id)}
                  className="flex-none text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  {t('hideFromMyFiles', locale)}
                </button>
              </li>
            ))}
          </ul>
          {nextBeforeId !== null && (
            <button
              type="button"
              onClick={() => void load(query, nextBeforeId, true)}
              disabled={loading}
              className="mt-2 w-full text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('loadMore', locale)}
            </button>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel', locale)}
          </Button>
          <Button type="button" onClick={() => void confirm()} disabled={submitting || selected.size === 0}>
            {t('save', locale)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
