import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ResultProofCell } from './ResultProofCell';
import { useT } from '../../lib/i18n/react';
import type { FolderResultRow } from '../../services/api/examFolders';
import '@/lib/i18n/catalogs/exams';

const num = (v: number | null) => (v == null ? '—' : String(v));

function Score({ r }: { r: FolderResultRow }) {
  return (
    <span className="font-semibold">
      {r.total_score}
      {r.exam_type === 'sat' && r.verbal_score != null && (
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">V {r.verbal_score} · M {r.math_score}</span>
      )}
      {r.exam_type === 'ielts' && r.listening_band != null && (
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
          L {num(r.listening_band)} · R {num(r.reading_band)} · W {num(r.writing_band)} · S {num(r.speaking_band)}
        </span>
      )}
    </span>
  );
}

interface Props {
  rows: FolderResultRow[];
  canWrite: boolean;
  showSitting: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}

/** The table inside a folder: score, proof and status of every result, one row per result. */
export function FolderTable({ rows, canWrite, showSitting, onChanged, onError }: Props) {
  const t = useT();
  return (
    <>
    {/* Phones: one card per result - a six-column table does not fit. */}
    <ul className="divide-y md:hidden">
      {rows.map((r) => (
        <li key={r.result_id} className="space-y-2 px-4 py-3" data-testid="folder-card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium">{r.student_name}</div>
              <div className="text-[11px] text-muted-foreground">
                {r.group_name ?? '—'}{r.curator_name ? ` · ${r.curator_name}` : ''}
              </div>
            </div>
            <div className="shrink-0 text-right text-sm"><Score r={r} /></div>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {r.exam_type.toUpperCase()} · {r.test_date}
            {r.recorded_by_name ? ` · ${t('exams.status.recordedBy', { name: r.recorded_by_name })}` : ''}
            {r.verified_by_name ? ` · ${t('exams.status.verifiedBy', { name: r.verified_by_name })}` : ''}
          </div>
          <ResultProofCell
            result={{ id: r.result_id, status: r.status, has_proof: r.has_proof,
                      verified_by_name: r.verified_by_name, recorded_by_name: r.recorded_by_name }}
            canWrite={canWrite} label={`${r.student_name} · ${r.exam_type.toUpperCase()} ${r.test_date}`}
            onChanged={onChanged} onError={onError} />
        </li>
      ))}
    </ul>
    <div className="hidden overflow-x-auto md:block">
      <Table className="w-full text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-[3] w-48 border-r bg-background">{t('exams.folders.col.student')}</TableHead>
            <TableHead className="min-w-[10rem]">{t('exams.folders.col.group')}</TableHead>
            {showSitting && <TableHead>{t('exams.folders.col.date')}</TableHead>}
            <TableHead>{t('exams.folders.col.score')}</TableHead>
            <TableHead className="min-w-[9rem] text-center">{t('exams.folders.col.status')}</TableHead>
            <TableHead>{t('exams.folders.col.by')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.result_id} data-testid="folder-row">
              <TableCell className="sticky left-0 z-[2] border-r bg-background font-medium">{r.student_name}</TableCell>
              <TableCell className="text-muted-foreground">
                <div>{r.group_name ?? '—'}</div>
                {r.curator_name && <div className="text-[10px]">{t('exams.folders.col.curator')}: {r.curator_name}</div>}
              </TableCell>
              {showSitting && <TableCell className="whitespace-nowrap">{r.exam_type.toUpperCase()} · {r.test_date}</TableCell>}
              <TableCell className="whitespace-nowrap"><Score r={r} /></TableCell>
              <TableCell>
                <ResultProofCell
                  result={{ id: r.result_id, status: r.status, has_proof: r.has_proof,
                            verified_by_name: r.verified_by_name, recorded_by_name: r.recorded_by_name }}
                  canWrite={canWrite} label={`${r.student_name} · ${r.exam_type.toUpperCase()} ${r.test_date}`}
                  onChanged={onChanged} onError={onError} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                <div>{r.recorded_by_name ?? '—'}</div>
                {r.verified_by_name && <div className="text-green-700 dark:text-green-400">{r.verified_by_name}</div>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </>
  );
}
