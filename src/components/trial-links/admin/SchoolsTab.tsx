import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, GitMerge, Pencil, Plus, Search } from 'lucide-react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { NativeSelect } from '../../ui/native-select';
import { toast } from '../../Toast';
import { useT } from '../../../lib/i18n/react';
import { createStaffSchool, listStaffSchools, mergeStaffSchool, updateStaffSchool, type StaffSchool } from '../../../services/api/trialLinks';
import '@/lib/i18n/catalogs/trialLinks';

const label = (s: StaffSchool) => (s.city ? `${s.name}, ${s.city}` : s.name);

export default function SchoolsTab() {
  const t = useT();
  const [schools, setSchools] = useState<StaffSchool[]>([]);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [editing, setEditing] = useState<StaffSchool | null>(null);
  const [merging, setMerging] = useState<StaffSchool | null>(null);
  const [mergeInto, setMergeInto] = useState('');

  const reload = useCallback(() => { listStaffSchools().then(setSchools).catch(() => toast(t('trialLinks.admin.loadFailed'), 'error')); }, [t]);
  useEffect(() => { reload(); }, [reload]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q ? schools.filter((s) => label(s).toLowerCase().includes(q)) : schools;
    return [...rows].sort((a, b) => Number(a.confirmed) - Number(b.confirmed) || b.signups - a.signups || a.name.localeCompare(b.name));
  }, [schools, query]);

  const run = async (work: () => Promise<unknown>, done?: string) => {
    try {
      await work();
      if (done) toast(done, 'success');
      reload();
    } catch {
      toast(t('trialLinks.admin.saveFailed'), 'error');
    }
  };

  const pendingCount = schools.filter((s) => !s.confirmed).length;

  return (
    <div className="space-y-5">
      {pendingCount > 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{t('trialLinks.schools.pendingHelp')}</p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} className="w-72 pl-9" placeholder={t('trialLinks.present.schoolSearch')} />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('trialLinks.present.newSchoolName')} className="w-56" maxLength={160} />
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('trialLinks.present.newSchoolCity')} className="w-36" maxLength={80} />
          <Button disabled={name.trim().length < 2}
            onClick={() => run(async () => { await createStaffSchool({ name: name.trim(), city: city.trim() || undefined }); setName(''); setCity(''); }, t('trialLinks.admin.saved'))}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />{t('trialLinks.schools.add')}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-left font-medium">{t('trialLinks.admin.col.school')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('trialLinks.admin.col.city')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('trialLinks.admin.col.status')}</th>
              <th className="px-3 py-2.5 text-right font-medium">{t('trialLinks.admin.col.signups')}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-muted-foreground">{t('trialLinks.admin.empty')}</td></tr>}
            {shown.map((s) => (
              <tr key={s.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5 font-medium text-foreground">{s.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{s.city ?? '—'}</td>
                <td className="px-3 py-2.5">
                  {s.confirmed ? <span className="text-xs text-emerald-700 dark:text-emerald-400">{t('trialLinks.schools.confirmed')}</span> : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">{t('trialLinks.schools.pending')}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{s.signups}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    {!s.confirmed && (
                      <Button size="sm" variant="outline" onClick={() => run(() => updateStaffSchool(s.id, { confirmed: true }))}>
                        <Check className="mr-1 h-3.5 w-3.5" aria-hidden />{t('trialLinks.schools.confirm')}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(s)} title={t('trialLinks.schools.rename')}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { setMerging(s); setMergeInto(''); }} title={t('trialLinks.schools.merge')}><GitMerge className="h-3.5 w-3.5" aria-hidden /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('trialLinks.schools.rename')}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>{t('trialLinks.present.newSchoolName')}</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={160} /></div>
              <div className="space-y-1"><Label>{t('trialLinks.present.newSchoolCity')}</Label>
                <Input value={editing.city ?? ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} maxLength={80} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t('trialLinks.schools.cancel')}</Button>
            <Button onClick={() => editing && run(async () => {
              await updateStaffSchool(editing.id, { name: editing.name, city: editing.city || null });
              setEditing(null);
            }, t('trialLinks.admin.saved'))}>{t('trialLinks.schools.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={merging !== null} onOpenChange={(open) => { if (!open) setMerging(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{merging ? t('trialLinks.schools.mergeTitle', { name: label(merging) }) : ''}</DialogTitle>
            <DialogDescription>{t('trialLinks.schools.mergeHelp')}</DialogDescription>
          </DialogHeader>
          <NativeSelect className="flex w-full" value={mergeInto} onValueChange={setMergeInto} searchable placeholder={t('trialLinks.schools.merge')}>
            <option value="">—</option>
            {schools.filter((s) => s.id !== merging?.id).map((s) => <option key={s.id} value={String(s.id)}>{label(s)}</option>)}
          </NativeSelect>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMerging(null)}>{t('trialLinks.schools.cancel')}</Button>
            <Button disabled={!mergeInto} onClick={() => merging && run(async () => {
              const { moved } = await mergeStaffSchool(merging.id, Number(mergeInto));
              setMerging(null);
              toast(t('trialLinks.schools.mergeDone', { count: moved }), 'success');
            })}>{t('trialLinks.schools.merge')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
