import { Checkbox } from '../ui/checkbox';
import { StepBadge } from './parts';
import { checklistText } from '../../lib/offboarding';
import {
  STEP_NAMES,
  type ChecklistItem,
  type Handover,
  type OpenItem,
  type OwnedSnapshot,
  type StepName,
  type StepResult,
} from '../../services/api/offboarding';
import { roleLabel } from '../../lib/roleLabel';
import { formatDate, formatDateTime, hasMessage, t as translate } from '../../lib/i18n';
import { useLocale, useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

/** Each system's result (SPEC §5), in the order the engine runs them. */
export function StepsList({ steps }: { steps: Partial<Record<StepName, StepResult>> | null | undefined }) {
  const t = useT();
  const ran = STEP_NAMES.filter((s) => steps?.[s]);
  if (!ran.length) return <p className="text-sm text-muted-foreground">{t('offboarding.record.stepsNotRun')}</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {ran.map((name) => {
        const step = steps![name]!;
        return (
          <li key={name} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="w-40 shrink-0 text-sm font-medium text-foreground">{t(`offboarding.step.${name}`)}</div>
            <div className="min-w-0 flex-1 space-y-1">
              <StepBadge status={step.status} />
              {step.reason && <p className="text-sm text-muted-foreground">{step.reason}</p>}
              {step.detail && <p className="break-words text-sm text-muted-foreground">{step.detail}</p>}
            </div>
            <div className="shrink-0 text-xs text-muted-foreground">
              {[step.at ? formatDateTime(step.at) : '', step.attempts && step.attempts > 1 ? t('offboarding.record.attempts', { count: step.attempts }) : '']
                .filter(Boolean).join(' · ')}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface ChecklistProps {
  items: ChecklistItem[];
  canTick: boolean;
  onTick: (itemId: string, done: boolean) => void;
}

/** What the owner does by hand (SPEC §5.5), ticked as it is done. */
export function Checklist({ items, canTick, onTick }: ChecklistProps) {
  const t = useT();
  const locale = useLocale();
  if (!items.length) return <p className="text-sm text-muted-foreground">{t('offboarding.record.checklistEmpty')}</p>;
  const textOf = (item: ChecklistItem) =>
    checklistText(item, (key, params) => (hasMessage(key) ? translate(key, params, locale) : null));
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-3">
          <Checkbox
            id={`checklist-${item.id}`}
            checked={item.done}
            disabled={!canTick}
            onCheckedChange={(c) => onTick(item.id, c === true)}
            className="mt-0.5"
          />
          <label htmlFor={`checklist-${item.id}`} className="text-sm">
            <span className={item.done ? 'text-muted-foreground line-through' : 'text-foreground'}>{textOf(item)}</span>
            {item.done && (item.done_by || item.done_at) && (
              <span className="ml-2 text-xs text-muted-foreground">
                {t('offboarding.record.tickedBy', { name: item.done_by?.name ?? '—', date: item.done_at ? formatDate(item.done_at) : '' })}
              </span>
            )}
          </label>
        </li>
      ))}
    </ul>
  );
}

/** What an emergency switch-off left assigned (SPEC §12 Q93); resolved items are struck through. */
export function OpenItemsList({ items }: { items: OpenItem[] }) {
  const t = useT();
  if (items.every((i) => i.resolved)) return <p className="text-sm text-muted-foreground">{t('offboarding.record.openItemsDone')}</p>;
  return (
    <>
      <p className="text-sm text-muted-foreground">{t('offboarding.record.openItemsIntro')}</p>
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li key={`${item.kind}:${item.id}`} className={item.resolved ? 'text-muted-foreground line-through' : 'text-foreground'}>
            <span className="text-muted-foreground">{t(`offboarding.handover.${item.kind}`)}:</span>{' '}
            {item.label || item.group_name || `#${item.id}`}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Who received what in the reassign helper. */
export function HandoverList({ handovers }: { handovers: Handover[] }) {
  const t = useT();
  if (!handovers.length) return null;
  return (
    <ul className="space-y-1 text-sm">
      {handovers.map((h, i) => (
        <li key={i} className="text-foreground">
          <span className="text-muted-foreground">{t(`offboarding.handover.${h.kind}`)}:</span>{' '}
          {t('offboarding.record.handedTo', { item: h.label, name: h.to_name })}
          {h.moved_lessons ? ` · ${t('offboarding.handover.lessonsMove', { count: h.moved_lessons })}` : ''}
          <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(h.at)}</span>
        </li>
      ))}
    </ul>
  );
}

export const ownedAnything = (owned: OwnedSnapshot | null | undefined) =>
  (owned?.groups?.length ?? 0) + (owned?.courses_headed?.length ?? 0) + (owned?.telegram_chats?.length ?? 0) > 0;

/** What they owned when the offboarding was requested. */
export function OwnedSummary({ owned }: { owned: OwnedSnapshot | null | undefined }) {
  const t = useT();
  const locale = useLocale();
  const groups = (owned?.groups ?? []).map((g) => (g.role ? `${g.name} (${roleLabel(g.role, locale)})` : g.name));
  const courses = (owned?.courses_headed ?? []).map((c) => c.title);
  const chats = (owned?.telegram_chats ?? []).map((c) => c.chat_title);
  if (!ownedAnything(owned)) return null;
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-3">
      <OwnedList title={t('offboarding.record.ownedGroups')} items={groups} />
      <OwnedList title={t('offboarding.record.ownedCourses')} items={courses} />
      <OwnedList title={t('offboarding.record.ownedChats')} items={chats} />
    </div>
  );
}

function OwnedList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="list-disc space-y-0.5 pl-5 text-foreground">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}
