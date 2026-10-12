import { CheckCircle2, CircleArrowRight, CircleHelp, Lock, type LucideIcon } from 'lucide-react';
import { Button } from '../ui/button';
import type { MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import {
  nextStep, resolveSteps, stepCopy, stepProgress, STATE_LABEL, STATE_TONE,
  type ResolvedStep, type StepState, type StepTone,
} from '../../lib/masterLeagueChecklist';
import type { ChecklistGroup, ChecklistStep } from '../../services/api/masterLeagueSetup';
import '@/lib/i18n/catalogs/announcements';

const STATE_ICON: Record<StepState, LucideIcon> = {
  done: CheckCircle2,
  waiting: CircleArrowRight,
  blocked: Lock,
  unknown: CircleHelp,
};

const ICON_TONE: Record<StepTone, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  attention: 'text-amber-600 dark:text-amber-400',
  muted: 'text-muted-foreground',
  neutral: 'text-muted-foreground',
};

const ROW_TONE: Record<StepTone, string> = {
  success: 'border-transparent',
  attention: 'border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30',
  muted: 'border-transparent',
  neutral: 'border-border bg-muted/40',
};

interface Props {
  group: ChecklistGroup;
  /** Jump to the Groups tab, where a chat is approved. */
  onOpenGroups?: () => void;
}

/**
 * One Master League group's Telegram setup: a progress line, then the steps in the order a person
 * does them. Only the step to do now carries its instruction, so the list never reads as seven
 * tasks at once; a finished group folds away.
 */
export function MasterLeagueGroupChecklist({ group, onOpenGroups }: Props) {
  const t = useT();
  const resolved = resolveSteps(group.steps);
  const { done, total } = stepProgress(group.steps);
  const next = nextStep(resolved);
  const params = { name: group.name, teacher: group.teacher_name ?? '' };
  const hasTeacher = !!group.teacher_name;

  const labelOf = (step: ChecklistStep) => {
    const copy = stepCopy(step.key, { hasTeacher });
    return copy ? t(copy.label) : step.label;
  };

  // Inside <summary> only phrasing content is valid, so the folded form uses spans.
  const heading = (folded: boolean) => {
    const Block = folded ? 'span' : 'div';
    const Name = folded ? 'span' : 'h4';
    return (
      <Block className="block min-w-0">
        <Name className="block break-words text-sm font-semibold text-foreground">{group.name}</Name>
        {group.teacher_name && (
          <span className="block text-xs text-muted-foreground">{t('announcements.mlChecklist.teacher', { name: group.teacher_name })}</span>
        )}
      </Block>
    );
  };

  const list = (
    <ol className="space-y-2">
      {resolved.map((r) => (
        <StepRow
          key={r.step.key}
          resolved={r}
          isNext={r === next}
          hasTeacher={hasTeacher}
          params={params}
          labelOf={labelOf}
          onOpenGroups={onOpenGroups}
        />
      ))}
    </ol>
  );

  if (group.ready) {
    return (
      <details className="rounded-lg border border-border bg-card p-3">
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
          {heading(true)}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            {t('announcements.mlChecklist.ready')}
          </span>
        </summary>
        <p className="mb-3 mt-3 text-sm text-muted-foreground">{t('announcements.mlChecklist.readyNote')}</p>
        {list}
      </details>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-3" aria-label={group.name}>
      {heading(false)}
      <p className="mt-2 text-sm text-foreground" aria-live="polite">
        <span className="font-medium tabular-nums">{t('announcements.mlChecklist.progress', { done, total })}</span>
        {next && <span className="text-muted-foreground"> · {t('announcements.mlChecklist.next', { step: labelOf(next.step) })}</span>}
      </p>
      <div className="mb-3 mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
      </div>
      {list}
    </section>
  );
}

interface RowProps {
  resolved: ResolvedStep;
  isNext: boolean;
  hasTeacher: boolean;
  params: { name: string; teacher: string };
  labelOf: (step: ChecklistStep) => string;
  onOpenGroups?: () => void;
}

function StepRow({ resolved, isNext, hasTeacher, params, labelOf, onOpenGroups }: RowProps) {
  const t = useT();
  const { step, state, blockedBy } = resolved;
  const copy = stepCopy(step.key, { hasTeacher });
  const tone = STATE_TONE[state];
  const Icon = STATE_ICON[state];
  const stateLabel = t(STATE_LABEL[state]);
  // A step this client has no words for shows the server's own (Russian) label and hint.
  const text = (key: MessageKey | undefined, fallback: string) => (key ? t(key, params) : fallback);

  return (
    <li className={`flex gap-3 rounded-md border px-3 py-2 ${ROW_TONE[tone]}`} aria-current={isNext ? 'step' : undefined}>
      <Icon className={`mt-0.5 h-5 w-5 flex-none ${ICON_TONE[tone]}`} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className={`break-words text-sm font-medium ${state === 'done' || state === 'blocked' ? 'text-muted-foreground' : 'text-foreground'}`}>
            {labelOf(step)}
          </p>
          <span className={state === 'done' ? 'sr-only' : 'text-xs font-medium text-muted-foreground'}>
            {state === 'done' ? `, ${stateLabel}` : stateLabel}
          </span>
        </div>
        {state === 'waiting' && (
          <>
            {copy && <p className="text-xs text-muted-foreground">{t(copy.why, params)}</p>}
            <p className="text-sm text-foreground">{text(copy?.fix, step.hint)}</p>
            {copy?.action === 'openGroups' && onOpenGroups && (
              <Button type="button" size="sm" variant="outline" className="mt-1 h-8" onClick={onOpenGroups}>
                {t('announcements.mlChecklist.openGroups')}
              </Button>
            )}
          </>
        )}
        {state === 'blocked' && blockedBy && (
          <p className="text-xs text-muted-foreground">{t('announcements.mlChecklist.blockedBy', { step: labelOf(blockedBy) })}</p>
        )}
        {state === 'unknown' && <p className="text-xs text-muted-foreground">{t('announcements.mlChecklist.unknownNote')}</p>}
      </div>
    </li>
  );
}
