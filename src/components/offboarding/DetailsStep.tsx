import { AlertTriangle } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { FormProblem, OffboardForm } from '../../lib/offboarding';
import type { ReasonCode } from '../../services/api/offboarding';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

interface DetailsStepProps {
  name: string;
  form: OffboardForm;
  onChange: (form: OffboardForm) => void;
  reasons: readonly ReasonCode[];
  today: string;
  needsSecondAdmin: boolean;
  /** Admins, when the server offers it: switch off at once and leave the hand-over for later. */
  allowEmergency?: boolean;
  /** SAT did not answer the blocker check: a warning, never a block (SPEC §3). Null when checked. */
  satWarning?: string | null;
  /** Shown once the person tried to submit. */
  problems: FormProblem[];
  disabled?: boolean;
}

/** Last day or immediately, reason and note (SPEC §1, §9). The reason and note are for admins only. */
export default function DetailsStep({ name, form, onChange, reasons, today, needsSecondAdmin, allowEmergency, satWarning, problems, disabled }: DetailsStepProps) {
  const t = useT();
  const set = (patch: Partial<OffboardForm>) => onChange({ ...form, ...patch });
  const radio = 'flex cursor-pointer items-start gap-2 rounded-md border border-border p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-subtle/40';

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">{t('offboarding.form.title')}</h3>

      <fieldset className={`grid gap-2 ${allowEmergency ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`} disabled={disabled}>
        <legend className="sr-only">{t('offboarding.record.mode')}</legend>
        <label className={radio}>
          <input type="radio" name="offboard-mode" className="mt-1" checked={form.mode === 'scheduled'} onChange={() => set({ mode: 'scheduled' })} />
          <span>
            <span className="block text-sm font-medium text-foreground">{t('offboarding.form.onDate')}</span>
            <span className="block text-xs text-muted-foreground">{t('offboarding.form.lastDayHint')}</span>
          </span>
        </label>
        <label className={radio}>
          <input type="radio" name="offboard-mode" className="mt-1" checked={form.mode === 'immediate'} onChange={() => set({ mode: 'immediate' })} />
          <span>
            <span className="block text-sm font-medium text-foreground">{t('offboarding.form.immediately')}</span>
            <span className="block text-xs text-muted-foreground">{t('offboarding.form.immediatelyHint')}</span>
          </span>
        </label>
        {allowEmergency && (
          <label className={radio}>
            <input type="radio" name="offboard-mode" className="mt-1" checked={form.mode === 'emergency'} onChange={() => set({ mode: 'emergency' })} />
            <span>
              <span className="block text-sm font-medium text-foreground">{t('offboarding.form.emergency')}</span>
              <span className="block text-xs text-muted-foreground">{t('offboarding.form.emergencyHint')}</span>
            </span>
          </label>
        )}
      </fieldset>

      {form.mode === 'scheduled' && (
        <div className="space-y-1">
          <Label htmlFor="offboard-last-day">{t('offboarding.form.lastDay')}</Label>
          <Input
            id="offboard-last-day"
            type="date"
            min={today}
            value={form.lastDay}
            onChange={(e) => set({ lastDay: e.target.value })}
            disabled={disabled}
            className="w-full sm:w-48"
          />
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="offboard-reason">{t('offboarding.form.reason')}</Label>
        <Select value={form.reason || undefined} onValueChange={(v) => set({ reason: v as ReasonCode })} disabled={disabled}>
          <SelectTrigger id="offboard-reason" className="w-full sm:w-72">
            <SelectValue placeholder={t('offboarding.form.chooseReason')} />
          </SelectTrigger>
          <SelectContent>
            {reasons.map((r) => <SelectItem key={r} value={r}>{t(`offboarding.reason.${r}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="offboard-note">{t('offboarding.form.note')}</Label>
        <Textarea
          id="offboard-note"
          value={form.note}
          onChange={(e) => set({ note: e.target.value })}
          placeholder={t('offboarding.form.notePlaceholder')}
          rows={3}
          maxLength={2000}
          disabled={disabled}
        />
      </div>

      <p className="text-sm text-muted-foreground">{t('offboarding.form.whatHappens')}</p>
      {satWarning != null && (
        <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('offboarding.handover.satNotChecked')}{satWarning ? ` (${satWarning})` : ''}
        </p>
      )}
      {needsSecondAdmin && (
        <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/35 dark:text-amber-200">
          {t('offboarding.form.secondAdmin', { name })}
        </p>
      )}
      {problems.length > 0 && (
        <ul role="alert" className="text-sm text-destructive">
          {problems.map((p) => <li key={p}>{t(`offboarding.form.problem.${p}`)}</li>)}
        </ul>
      )}
    </div>
  );
}
