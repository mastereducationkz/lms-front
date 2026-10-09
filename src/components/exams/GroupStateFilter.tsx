import { Button } from '../ui/button';
import { useT } from '../../lib/i18n/react';
import { GROUP_STATES, type GroupState } from '../../lib/groupState';
import '@/lib/i18n/catalogs/exams';

const LABEL = {
  running: 'exams.groupState.running',
  finished: 'exams.groupState.finished',
  all: 'exams.groupState.all',
} as const;

/** «Groups: Running | Finished | All» — which of the caller's groups an exam page lists. */
export function GroupStateFilter({ value, onChange }: { value: GroupState; onChange: (state: GroupState) => void }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{t('exams.groupState.label')}</span>
      <div className="flex gap-1" role="group" aria-label={t('exams.groupState.label')} title={t('exams.groupState.hint')}>
        {GROUP_STATES.map((state) => (
          <Button key={state} size="sm" variant={value === state ? 'default' : 'outline'}
                  aria-pressed={value === state} onClick={() => onChange(state)}>
            {t(LABEL[state])}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** A small «finished» chip next to the name of a group that is over or archived. */
export function FinishedTag({ finished }: { finished?: boolean }) {
  const t = useT();
  if (!finished) return null;
  return (
    <span className="ml-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {t('exams.groupState.tag')}
    </span>
  );
}
