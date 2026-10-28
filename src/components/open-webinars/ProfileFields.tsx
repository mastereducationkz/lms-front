import type { ReactNode } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { GRADES, ROLES, gradeLabel, intakeYears, yearLabel, type ProfileDraft } from './profileQuestions';
import type { TFunction } from '../../lib/i18n/translate';
import '@/lib/i18n/catalogs/openWebinars';

const FIELD = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm';

interface Props {
  t: TFunction;
  value: ProfileDraft;
  onChange: (next: ProfileDraft) => void;
}

function Optional({ t }: { t: TFunction }) {
  return <span className="font-normal text-muted-foreground"> ({t('openWebinars.form.optional')})</span>;
}

function Field({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** «Who is registering?» — asked first, because the labels of the fields after it depend on the answer. */
export function RolePicker({ t, value, onChange }: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">{t('openWebinars.form.profile.role')}</legend>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((role) => (
          <label key={role} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="radio" name="ow-role" value={role} checked={value.role === role} onChange={() => onChange({ ...value, role })} />
            {t(`openWebinars.form.profile.role.${role}` as 'openWebinars.form.profile.role.student')}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The child's name: right after the parent's own name. */
export function ChildNameField({ t, value, onChange }: Props) {
  if (value.role !== 'parent') return null;
  return (
    <Field id="ow-child" label={<>{t('openWebinars.form.profile.childName')}<Optional t={t} /></>}>
      <Input id="ow-child" value={value.childName} onChange={(e) => onChange({ ...value, childName: e.target.value })} maxLength={120} />
    </Field>
  );
}

/** The second phone: the parent's when a student registers, the student's when a parent does. */
export function OtherPhoneField({ t, value, onChange }: Props) {
  const label = value.role === 'parent' ? 'openWebinars.form.profile.otherPhoneOfStudent' : 'openWebinars.form.profile.otherPhoneOfParent';
  return (
    <Field id="ow-other-phone" label={<>{t(label)}<Optional t={t} /></>}>
      <Input id="ow-other-phone" type="tel" inputMode="tel" value={value.otherPhone} onChange={(e) => onChange({ ...value, otherPhone: e.target.value })} placeholder="+7 700 000 00 00" />
    </Field>
  );
}

/** Grade (required), city, intake year, SAT and IELTS. */
export function SchoolFields({ t, value, onChange }: Props) {
  const set = (patch: Partial<ProfileDraft>) => onChange({ ...value, ...patch });
  return (
    <>
      <Field id="ow-grade" label={t(value.role === 'parent' ? 'openWebinars.form.profile.gradeParent' : 'openWebinars.form.profile.gradeStudent')}>
        <select id="ow-grade" className={FIELD} value={value.grade} onChange={(e) => set({ grade: e.target.value })} required>
          <option value="" disabled>{t('openWebinars.form.choose')}</option>
          {GRADES.map((g) => <option key={g} value={g}>{gradeLabel(g, t)}</option>)}
        </select>
      </Field>
      <Field id="ow-city" label={<>{t('openWebinars.form.profile.city')}<Optional t={t} /></>}>
        <Input id="ow-city" value={value.city} onChange={(e) => set({ city: e.target.value })} autoComplete="address-level2" maxLength={80} />
      </Field>
      <Field id="ow-year" label={<>{t('openWebinars.form.profile.year')}<Optional t={t} /></>}>
        <select id="ow-year" className={FIELD} value={value.intakeYear} onChange={(e) => set({ intakeYear: e.target.value })}>
          <option value="">{t('openWebinars.form.choose')}</option>
          {intakeYears().map((y) => <option key={y} value={y}>{yearLabel(y, t)}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="ow-sat" label={<>{t('openWebinars.form.profile.sat')}<Optional t={t} /></>}>
          <Input id="ow-sat" inputMode="numeric" value={value.satScore} onChange={(e) => set({ satScore: e.target.value })} placeholder="1400" maxLength={4} />
        </Field>
        <Field id="ow-ielts" label={<>{t('openWebinars.form.profile.ielts')}<Optional t={t} /></>}>
          <Input id="ow-ielts" inputMode="decimal" value={value.ieltsScore} onChange={(e) => set({ ieltsScore: e.target.value })} placeholder="6.5" maxLength={3} />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t('openWebinars.form.profile.scoreHint')}</p>
    </>
  );
}
