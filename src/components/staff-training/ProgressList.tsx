import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale, useT } from '@/lib/i18n/react';
import { formatDateTime } from '@/lib/i18n/format';
import type { ProgressRow } from '@/services/api/staffTraining';
import StateChip from './StateChip';
import { pick } from './model';
import '@/lib/i18n/catalogs/staffTraining';

interface Props {
  rows: ProgressRow[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
}

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span className="block h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className="block h-full rounded-full bg-brand-solid" style={{ width: `${pct}%` }} />
    </span>
  );
}

function useCells() {
  const t = useT();
  const locale = useLocale();
  return {
    t,
    role: (role: string) => (role in ROLE_KEYS ? t(ROLE_KEYS[role]) : role),
    step: (row: ProgressRow) => {
      if (!row.current_item) return <span className="text-muted-foreground">{row.state === 'done' ? t('staffTraining.progress.allDone') : '—'}</span>;
      const failed = row.current_item.failed_attempts;
      return (
        <>
          <span className="block text-foreground">{pick(row.current_item.title, locale)}</span>
          {failed > 0 && <span className="block text-xs text-amber-700 dark:text-amber-400">{t('staffTraining.progress.failedAttempts', { count: failed })}</span>}
        </>
      );
    },
    active: (row: ProgressRow) => (row.last_active_at ? formatDateTime(row.last_active_at, undefined, locale) : t('staffTraining.progress.noActivity')),
  };
}

export const ROLE_KEYS: Record<string, 'staffTraining.role.admin' | 'staffTraining.role.teacher' | 'staffTraining.role.head_teacher' | 'staffTraining.role.curator' | 'staffTraining.role.head_curator' | 'staffTraining.role.marketing'> = {
  admin: 'staffTraining.role.admin',
  teacher: 'staffTraining.role.teacher',
  head_teacher: 'staffTraining.role.head_teacher',
  curator: 'staffTraining.role.curator',
  head_curator: 'staffTraining.role.head_curator',
  marketing: 'staffTraining.role.marketing',
};

/**
 * Everyone's progress: a table once the page is wide enough, a card each below that (the page's own width decides,
 * not the window's). A stuck person's row says on which step and after how many failed tries.
 */
export default function ProgressList({ rows, selected, onToggle, onToggleAll }: Props) {
  const cells = useCells();
  const { t } = cells;
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.user.id));

  return (
    <div className="@container">
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm @3xl:block">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border text-left">
              <th className="w-10 py-2.5 pl-4"><input type="checkbox" aria-label={t('staffTraining.progress.selectAll')} checked={allOn} onChange={onToggleAll} className="h-4 w-4 accent-[hsl(var(--primary))]" /></th>
              <th className="px-3 py-2.5 font-medium">{t('staffTraining.progress.col.person')}</th>
              <th className="px-3 py-2.5 font-medium">{t('staffTraining.progress.col.state')}</th>
              <th className="px-3 py-2.5 font-medium">{t('staffTraining.progress.col.progress')}</th>
              <th className="px-3 py-2.5 font-medium">{t('staffTraining.progress.col.step')}</th>
              <th className="px-3 py-2.5 font-medium">{t('staffTraining.progress.col.active')}</th>
              <th className="w-8 pr-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user.id} data-person={row.user.id} data-state={row.state} className="border-b border-border/60 align-top last:border-0 hover:bg-muted/30">
                <td className="py-3 pl-4">
                  <input type="checkbox" aria-label={t('staffTraining.progress.selectPerson', { name: row.user.name })} checked={selected.has(row.user.id)} onChange={() => onToggle(row.user.id)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                </td>
                <td className="px-3 py-3">
                  <Link to={`/training/progress/${row.user.id}`} className="font-medium text-foreground hover:underline">{row.user.name}</Link>
                  <span className="block text-xs text-muted-foreground">{cells.role(row.user.role)} · {row.user.email}</span>
                </td>
                <td className="px-3 py-3">
                  <StateChip state={row.state} />
                  <span className="mt-1 block text-xs text-muted-foreground">{t(row.required ? 'staffTraining.required' : 'staffTraining.optional')}</span>
                </td>
                <td className="w-40 px-3 py-3">
                  <span className="mb-1 block text-xs tabular-nums text-foreground">{row.done_items} / {row.total_items}</span>
                  <Bar done={row.done_items} total={row.total_items} />
                </td>
                <td className="px-3 py-3">{cells.step(row)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{cells.active(row)}</td>
                <td className="py-3 pr-3"><Link to={`/training/progress/${row.user.id}`} aria-label={row.user.name} className="text-muted-foreground"><ChevronRight className="h-4 w-4" aria-hidden /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2.5 @3xl:hidden">
        {rows.map((row) => (
          <li key={row.user.id} data-person={row.user.id} data-state={row.state} className={cn('rounded-2xl border bg-card p-3.5 shadow-sm', selected.has(row.user.id) ? 'border-primary' : 'border-border')}>
            <div className="flex items-start gap-3">
              <input type="checkbox" aria-label={t('staffTraining.progress.selectPerson', { name: row.user.name })} checked={selected.has(row.user.id)} onChange={() => onToggle(row.user.id)} className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]" />
              <div className="min-w-0 flex-1">
                <Link to={`/training/progress/${row.user.id}`} className="block truncate font-medium text-foreground hover:underline">{row.user.name}</Link>
                <span className="block truncate text-xs text-muted-foreground">{cells.role(row.user.role)} · {row.user.email}</span>
              </div>
              <StateChip state={row.state} />
            </div>
            <div className="mt-3 space-y-2 pl-7 text-sm">
              <div>
                <span className="mb-1 block text-xs tabular-nums text-foreground">{row.done_items} / {row.total_items} · {t(row.required ? 'staffTraining.required' : 'staffTraining.optional')}</span>
                <Bar done={row.done_items} total={row.total_items} />
              </div>
              <div><span className="block text-xs text-muted-foreground">{t('staffTraining.progress.col.step')}</span>{cells.step(row)}</div>
              <p className="text-xs text-muted-foreground">{cells.active(row)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
