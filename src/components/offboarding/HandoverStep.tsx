import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { PersonSelect } from './parts';
import { toast } from '../Toast';
import {
  allToOptions,
  handoverItems,
  initialAssignments,
  mergeAssignments,
  ownerOptions,
  reassignPlan,
  type Assignments,
} from '../../lib/offboarding';
import {
  reassignOwned,
  type OffboardPreview,
  type ReassignItemResult,
  type ReassignRequest,
} from '../../services/api/offboarding';
import { formatDateTime } from '../../lib/i18n';
import { serverMessage } from '../../lib/i18n/serverError';
import { useLocale, useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

interface HandoverStepProps {
  preview: OffboardPreview;
  /** Fetch the preview again (after a reassign, or after moving SAT groups by hand). */
  onRecheck: () => Promise<void>;
}

/**
 * The reassign helper (SPEC §4): everything the person still owns, each with the suggested new
 * owner preselected and editable, plus «hand everything to». SAT-native groups are listed for
 * SAT admin only. The dialog moves on by itself once a recheck finds nothing owned.
 */
export default function HandoverStep({ preview, onRecheck }: HandoverStepProps) {
  const t = useT();
  const locale = useLocale();
  const { blockers, candidates, target } = preview;
  const items = useMemo(() => handoverItems(preview), [preview]);
  const [assignments, setAssignments] = useState<Assignments>(() => initialAssignments(items));
  const [allTo, setAllTo] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState<ReassignItemResult[]>([]);
  const [rechecking, setRechecking] = useState(false);

  useEffect(() => {
    setAssignments((previous) => mergeAssignments(previous, items));
  }, [items]);

  const plan = reassignPlan(items, assignments);
  const allPeople = allToOptions(items, candidates);
  const labelOf = new Map(items.map((i) => [i.key, i.label]));

  const run = async (request: ReassignRequest) => {
    setBusy(true);
    setError(null);
    setFailures([]);
    try {
      const result = await reassignOwned(request);
      const results = result.results ?? [];
      const failed = results.filter((r) => !r.ok);
      setFailures(failed);
      if (results.length > failed.length) toast(t('offboarding.handover.done', { count: results.length - failed.length }), 'success');
      await onRecheck();
    } catch (e) {
      setError((e instanceof Error && e.message) || t('offboarding.handover.failed'));
    } finally {
      setBusy(false);
    }
  };

  const recheck = async () => {
    setRechecking(true);
    try {
      await onRecheck();
    } finally {
      setRechecking(false);
    }
  };

  const lmsUserId = target.lms_user_id;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">{t('offboarding.handover.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('offboarding.handover.intro', { name: target.name })}</p>
      </div>

      {items.length > 0 && lmsUserId != null && (
        <>
          <ul className="divide-y divide-border rounded-md border border-border">
            {items.map((item) => (
              <li key={item.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t(`offboarding.handover.${item.kind}`)}</div>
                  <div className="truncate text-sm font-medium text-foreground" title={item.label}>{item.label}</div>
                  {item.startAt && (
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(item.startAt)}{item.groupName ? ` · ${item.groupName}` : ''}
                    </div>
                  )}
                  {!!item.movingLessons && (
                    <div className="text-xs text-muted-foreground">{t('offboarding.handover.lessonsMove', { count: item.movingLessons })}</div>
                  )}
                </div>
                <PersonSelect
                  people={ownerOptions(item, candidates)}
                  value={assignments[item.key] ?? null}
                  suggestedId={item.suggested?.id ?? null}
                  onChange={(id) => setAssignments((a) => ({ ...a, [item.key]: id }))}
                  ariaLabel={`${t(`offboarding.handover.${item.kind}`)}: ${item.label}`}
                  disabled={busy}
                  className="w-full sm:w-60"
                />
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => run({ lms_user_id: lmsUserId, items: plan.items })}
              disabled={busy || plan.items.length === 0}
            >
              {busy ? t('offboarding.handover.reassigning') : t('offboarding.handover.reassignChosen')}
            </Button>
            {plan.missing.length > 0 && (
              <span className="text-sm text-muted-foreground">{t('offboarding.handover.missing', { count: plan.missing.length })}</span>
            )}
          </div>

          <div className="space-y-2 rounded-md bg-muted/50 p-3">
            <div className="text-sm font-medium text-foreground">{t('offboarding.handover.allTo')}</div>
            {allPeople.length > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <PersonSelect people={allPeople} value={allTo} onChange={setAllTo} disabled={busy} className="w-full sm:w-60" />
                <Button
                  variant="outline"
                  onClick={() => allTo != null && run({ lms_user_id: lmsUserId, all_to: allTo })}
                  disabled={busy || allTo == null}
                >
                  {t('offboarding.handover.allToButton')}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('offboarding.handover.allToNobody')}</p>
            )}
          </div>
        </>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {failures.length > 0 && (
        <div role="alert" className="text-sm text-destructive">
          <p>{t('offboarding.handover.someFailed')}</p>
          <ul className="list-disc pl-5">
            {failures.map((f) => (
              <li key={`${f.kind}:${f.id}`}>{labelOf.get(`${f.kind}:${f.id}`) ?? `#${f.id}`}{f.error ? `: ${serverMessage(f.error.code, f.error.message, locale)}` : ''}</li>
            ))}
          </ul>
        </div>
      )}

      {blockers.sat_native.length > 0 && (
        <div className="space-y-1 rounded-md border border-border p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {t('offboarding.handover.satTitle')}
          </div>
          <p className="text-sm text-muted-foreground">{t('offboarding.handover.satIntro')}</p>
          <ul className="list-disc pl-5 text-sm">
            {blockers.sat_native.map((g) => <li key={String(g.id)}>{g.name}</li>)}
          </ul>
        </div>
      )}

      {!blockers.sat_checked && (
        <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('offboarding.handover.satNotChecked')}{blockers.sat_warning ? ` (${blockers.sat_warning})` : ''}
        </p>
      )}

      <Button variant="ghost" size="sm" onClick={recheck} disabled={busy || rechecking}>
        <RefreshCw className={`mr-2 h-4 w-4 ${rechecking ? 'animate-spin' : ''}`} aria-hidden="true" />
        {t('offboarding.handover.recheck')}
      </Button>
    </div>
  );
}
