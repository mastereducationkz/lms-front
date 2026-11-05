import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Download, Search } from 'lucide-react';
import { NativeSelect } from '@/components/ui/native-select';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FolderList } from './FolderList';
import { FolderTable } from './FolderTable';
import { folderName, scopeOfKey } from './folderLabel';
import { useLocale, useT } from '../../lib/i18n/react';
import { getExamGroups, type ExamGroupOption } from '../../services/api/exams';
import {
  exportFolderResults, getFolderResults, getResultFolders,
  type FolderFilters, type FolderList as FolderListData, type FolderResultRow, type ResultStatus,
} from '../../services/api/examFolders';
import '@/lib/i18n/catalogs/exams';

type Exam = '' | 'sat' | 'ielts' | 'nuet';

const EMPTY: FolderListData = {
  folders: [],
  all: { key: 'all', exam_type: 'all', test_date: null, total: 0, with_proof: 0, unconfirmed: 0, reported: 0, verified: 0, rejected: 0 },
  curators: [],
};

/**
 * The «Папки» view of /exam-results: one folder per exam sitting (exam type + date) plus «Все результаты».
 * A flat filter (exam, group, curator, status, proof, search) narrows every folder at once; each
 * folder is a table of results with their score reports, and exports to Excel with a proof link.
 */
export function ResultFoldersView({ canWrite }: { canWrite: boolean }) {
  const t = useT();
  const locale = useLocale();
  const [exam, setExam] = useState<Exam>('');
  const [groupId, setGroupId] = useState<number | ''>('');
  const [curatorId, setCuratorId] = useState<number | ''>('');
  const [status, setStatus] = useState<ResultStatus | ''>('');
  const [proof, setProof] = useState<'' | 'with' | 'without'>('');
  const [unconfirmedOnly, setUnconfirmedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('all');
  const [groups, setGroups] = useState<ExamGroupOption[]>([]);
  const [data, setData] = useState<FolderListData>(EMPTY);
  const [rows, setRows] = useState<FolderResultRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [tick, setTick] = useState(0);

  const base: FolderFilters = useMemo(() => ({
    ...(exam ? { examType: exam } : {}),
    ...(groupId !== '' ? { groupId } : {}),
    ...(curatorId !== '' ? { curatorId } : {}),
    ...(status ? { status } : {}),
    ...(proof ? { proof } : {}),
    ...(unconfirmedOnly ? { unconfirmedOnly: true } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  }), [exam, groupId, curatorId, status, proof, unconfirmedOnly, search]);

  useEffect(() => {
    let cancelled = false;
    getExamGroups({ groupState: 'all', ...(exam ? { program: exam } : {}) })
      .then((g) => { if (!cancelled) setGroups(g); }, () => { /* the group filter stays empty */ });
    return () => { cancelled = true; };
  }, [exam]);

  // The folder list: one query per filter change. A folder that emptied out under the new filters is gone.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const list = await getResultFolders(base);
        if (cancelled) return;
        setData(list);
        setSelected((key) => (key === 'all' || list.folders.some((f) => f.key === key) ? key : 'all'));
      } catch (e: any) {
        if (cancelled) return;
        setData(EMPTY);
        setError(e?.response?.status === 403 ? t('exams.errors.noAccess') : t('exams.folders.loadFailed'));
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [base, tick, t]);

  // The table of the selected folder.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getFolderResults({ ...base, ...scopeOfKey(selected) });
        if (cancelled) return;
        setRows(res.rows);
        setTotal(res.total);
      } catch (e: any) {
        if (cancelled) return;
        setRows([]); setTotal(0);
        setError(e?.response?.status === 403 ? t('exams.errors.noAccess') : t('exams.folders.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [base, selected, tick, t]);

  const folder = data.folders.find((f) => f.key === selected);
  const scope = scopeOfKey(selected);
  const title = folder ? folderName(folder, locale) : t('exams.folders.all');
  const counts = folder ?? data.all;
  const reload = useCallback(() => setTick((n) => n + 1), []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportFolderResults({ ...base, ...scope });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam-results-folder_${selected.replace(':', '-')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('exams.errors.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const field = 'mt-1 block w-full';
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-2 @lg:grid-cols-2 @3xl:grid-cols-4">
            <div>
              <label htmlFor="ef-exam" className="text-xs font-medium">{t('exams.folders.exam')}</label>
              <NativeSelect id="ef-exam" value={exam} className={field}
                            onChange={(e) => { setExam(e.target.value as Exam); setGroupId(''); setSelected('all'); }}>
                <option value="">{t('exams.folders.anyExam')}</option>
                <option value="sat">SAT</option><option value="ielts">IELTS</option><option value="nuet">NUET</option>
              </NativeSelect>
            </div>
            <div>
              <label htmlFor="ef-group" className="text-xs font-medium">{t('exams.filters.group')}</label>
              <NativeSelect id="ef-group" value={groupId} className={field}
                            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">{t('exams.folders.anyGroup')}</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <label htmlFor="ef-curator" className="text-xs font-medium">{t('exams.folders.curator')}</label>
              <NativeSelect id="ef-curator" value={curatorId} className={field}
                            onChange={(e) => setCuratorId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">{t('exams.folders.anyCurator')}</option>
                {data.curators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </div>
            <div>
              <label htmlFor="ef-status" className="text-xs font-medium">{t('exams.folders.status')}</label>
              <NativeSelect id="ef-status" value={status} className={field}
                            onChange={(e) => setStatus(e.target.value as ResultStatus | '')}>
                <option value="">{t('exams.folders.anyStatus')}</option>
                <option value="reported">{t('exams.resultStatus.reported')}</option>
                <option value="verified">{t('exams.resultStatus.verified')}</option>
                <option value="rejected">{t('exams.resultStatus.rejected')}</option>
              </NativeSelect>
            </div>
            <div>
              <label htmlFor="ef-proof" className="text-xs font-medium">{t('exams.folders.proof')}</label>
              <NativeSelect id="ef-proof" value={proof} className={field}
                            onChange={(e) => setProof(e.target.value as '' | 'with' | 'without')}>
                <option value="">{t('exams.folders.anyProof')}</option>
                <option value="with">{t('exams.folders.withProof')}</option>
                <option value="without">{t('exams.folders.withoutProof')}</option>
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[14rem] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                     placeholder={t('exams.folders.search')} aria-label={t('exams.filters.searchLabel')} className="pl-8" />
            </div>
            {/* One click for the question curators ask most: which results have their screenshot. */}
            <Button type="button" size="sm" variant={proof === 'with' ? 'default' : 'outline'}
                    aria-pressed={proof === 'with'} title={t('exams.folders.onlyWithProofHint')}
                    onClick={() => setProof(proof === 'with' ? '' : 'with')}>
              <Camera className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t('exams.folders.onlyWithProof')}
            </Button>
            <label className="inline-flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={unconfirmedOnly} onChange={(e) => setUnconfirmedOnly(e.target.checked)} />
              {t('exams.folders.unconfirmedOnly')}
            </label>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300" role="alert">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
        <FolderList all={data.all} folders={data.folders} selected={selected} onSelect={setSelected} />
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {loading ? t('common.loading') : t('exams.folders.counts', { total, proof: counts.with_proof })}
                </p>
              </div>
              <Button size="sm" onClick={handleExport} disabled={exporting || total === 0}>
                <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {exporting ? t('exams.export.running') : t('exams.folders.export')}
              </Button>
            </div>
            {!loading && rows.length === 0 && !error && (
              <p className="p-8 text-center text-muted-foreground">{t('exams.folders.none')}</p>
            )}
            {rows.length > 0 && (
              <FolderTable rows={rows} canWrite={canWrite} showSitting={selected === 'all'}
                           onChanged={reload} onError={setError} />
            )}
            {total > rows.length && (
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                {t('exams.folders.capped', { shown: rows.length, total })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
