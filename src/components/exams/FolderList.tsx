import { NativeSelect } from '@/components/ui/native-select';
import { useLocale, useT } from '../../lib/i18n/react';
import type { ExamFolder } from '../../services/api/examFolders';
import { folderName } from './folderLabel';
import '@/lib/i18n/catalogs/exams';

interface Props {
  all: ExamFolder;
  folders: ExamFolder[];
  selected: string;
  onSelect: (key: string) => void;
}

const badge = 'rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';

/** One row per sitting («SAT · 7 нояб. 2026»), «Все результаты» on top; a select on narrow screens. */
export function FolderList({ all, folders, selected, onSelect }: Props) {
  const t = useT();
  const locale = useLocale();
  const items = [{ f: all, name: t('exams.folders.all') }, ...folders.map((f) => ({ f, name: folderName(f, locale) }))];

  return (
    <>
      <div className="md:hidden">
        <label htmlFor="er-folder" className="text-xs font-medium">{t('exams.folders.pick')}</label>
        <NativeSelect id="er-folder" value={selected} className="mt-1 block w-full"
                      onChange={(e) => onSelect(e.target.value)}>
          {items.map(({ f, name }) => (
            <option key={f.key} value={f.key}>
              {name} ({f.total}{f.unconfirmed ? `, ${t('exams.folders.unconfirmedBadge', { n: f.unconfirmed })}` : ''})
            </option>
          ))}
        </NativeSelect>
      </div>
      <nav className="hidden md:block" aria-label={t('exams.folders.list')}>
        <ul className="space-y-1">
          {items.map(({ f, name }) => (
            <li key={f.key}>
              <button type="button" onClick={() => onSelect(f.key)} aria-current={selected === f.key ? 'true' : undefined}
                      className={`w-full rounded-md border px-3 py-2 text-left transition-colors
                        ${selected === f.key ? 'border-primary bg-brand-subtle' : 'border-transparent hover:bg-accent'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{name}</span>
                  {f.unconfirmed > 0 && <span className={badge}>{t('exams.folders.unconfirmedBadge', { n: f.unconfirmed })}</span>}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {t('exams.folders.counts', { total: f.total, proof: f.with_proof })}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
