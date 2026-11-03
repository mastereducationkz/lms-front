import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { cn } from '../../../lib/utils';
import TurnstileWidget, { turnstileSiteKey, type TurnstileHandle } from '../../open-webinars/TurnstileWidget';
import SchoolPicker, { type SchoolChoice } from './SchoolPicker';
import { PublicApiError } from '../../../services/api/publicWebinars';
import type { Grade, Interest, PublicTrialLink, SignupBody } from '../../../services/api/trialLinks';
import { captureAttribution } from '../../../lib/utm';
import { hasMessage, type TFunction } from '../../../lib/i18n/translate';
import type { Locale } from '../../../lib/i18n/locale';
import '@/lib/i18n/catalogs/trialLinks';

/** What went wrong, in the visitor's language: the backend's stable code when the catalog knows it. */
export function signupErrorText(error: unknown, t: TFunction): string {
  if (error instanceof PublicApiError) {
    const key = `trialLinks.error.${error.code}`;
    if (error.code && hasMessage(key)) return t(key);
  }
  return t('trialLinks.error.generic');
}

const GRADE_KEYS: Partial<Record<Grade, 'trialLinks.form.grade.graduated' | 'trialLinks.form.grade.other'>> = {
  graduated: 'trialLinks.form.grade.graduated',
  other: 'trialLinks.form.grade.other',
};
const INTEREST_KEYS = {
  sat: 'trialLinks.form.interest.sat',
  ielts: 'trialLinks.form.interest.ielts',
  nuet: 'trialLinks.form.interest.nuet',
  unsure: 'trialLinks.form.interest.unsure',
} as const;

/** The first problem the page can see before asking the server (the server checks everything again). */
export function missingField(v: { first: string; last: string; phone: string; email: string; grade: Grade | null;
  interests: Interest[]; school: SchoolChoice; consent: boolean }): string | null {
  if (!v.first.trim()) return 'first_name_invalid';
  if (!v.last.trim()) return 'last_name_invalid';
  if (v.phone.replace(/\D/g, '').length < 10) return 'phone_invalid';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.email.trim())) return 'email_invalid';
  if (v.school.kind === 'none') return 'school_required';
  if (v.school.kind === 'new' && v.school.name.trim().length < 2) return 'school_name_invalid';
  if (v.school.kind === 'new' && v.school.city.trim().length < 2) return 'city_required';
  if (!v.grade) return 'grade_required';
  if (v.interests.length === 0) return 'interests_required';
  if (!v.consent) return 'consent_required';
  return null;
}

function Field({ id, label, hint, optional, children }: { id: string; label: string; hint?: string; optional?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-baseline gap-1.5">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">({optional})</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface Props {
  t: TFunction;
  locale: Locale;
  link: PublicTrialLink;
  onSubmit: (body: SignupBody) => Promise<void>;
}

/** One screen, about thirty seconds on a phone. Every choice is a tap; only names, phone and e-mail are typed. */
export default function SignupForm({ t, locale, link, onSubmit }: Props) {
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [school, setSchool] = useState<SchoolChoice>(
    link.schools_running.length === 1 ? { kind: 'picked', school: link.schools_running[0] } : { kind: 'none' });
  const [grade, setGrade] = useState<Grade | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [parentPhone, setParentPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const siteKey = turnstileSiteKey();
  const check = useRef<TurnstileHandle>(null);
  const [token, setToken] = useState<string | null>(null);
  const waitingForCheck = siteKey !== '' && !token;

  const toggleInterest = (value: Interest) =>
    setInterests((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const missing = missingField({ first, last, phone, email, grade, interests, school, consent });
    if (missing) {
      setError(t(`trialLinks.error.${missing}` as Parameters<TFunction>[0]));
      return;
    }
    if (waitingForCheck || !grade) return;
    setBusy(true);
    setError(null);
    const { utm, referer } = captureAttribution();
    try {
      await onSubmit({
        first_name: first.trim(), last_name: last.trim(), phone: phone.trim(), email: email.trim(), grade, interests,
        ...(parentPhone.trim() ? { parent_phone: parentPhone.trim() } : {}),
        ...(school.kind === 'picked' ? { school_id: school.school.id } : {}),
        ...(school.kind === 'new' ? { new_school: { name: school.name.trim(), city: school.city.trim() } } : {}),
        consent, lang: locale, utm, referer, tl_extra: trap,
        ...(siteKey && token ? { captcha_token: token } : {}),
      });
    } catch (failure) {
      setError(signupErrorText(failure, t));
      setBusy(false);
      check.current?.reset();
    }
  };

  const consentText = locale === 'ru' ? link.consent.text_ru : link.consent.text_en;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="tl-first" label={t('trialLinks.form.firstName')}>
          <Input id="tl-first" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" maxLength={60} />
        </Field>
        <Field id="tl-last" label={t('trialLinks.form.lastName')}>
          <Input id="tl-last" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" maxLength={60} />
        </Field>
      </div>
      <Field id="tl-phone" label={t('trialLinks.form.phone')}>
        <Input id="tl-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel" placeholder="+7 700 000 00 00" maxLength={40} />
      </Field>
      <Field id="tl-email" label={t('trialLinks.form.email')} hint={t('trialLinks.form.emailHint')}>
        <Input id="tl-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={320} />
      </Field>

      <SchoolPicker t={t} code={link.code} running={link.schools_running} value={school} onChange={setSchool} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium leading-none text-foreground">{t('trialLinks.form.grade')}</legend>
        {[link.grades.filter((g) => !GRADE_KEYS[g]), link.grades.filter((g) => GRADE_KEYS[g])].map((row, i) => (
          <div key={i} className={cn('grid gap-2', i === 0 ? 'grid-cols-5' : 'grid-cols-2')}>
            {row.map((g) => (
              <button key={g} type="button" aria-pressed={grade === g} onClick={() => setGrade(g)}
                className={cn('h-11 rounded-xl border text-sm font-semibold transition',
                  grade === g ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card text-foreground hover:border-primary/50')}>
                {GRADE_KEYS[g] ? t(GRADE_KEYS[g]!) : g}
              </button>
            ))}
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium leading-none text-foreground">
          {t('trialLinks.form.interests')}{' '}
          <span className="text-xs font-normal text-muted-foreground">· {t('trialLinks.form.interestsHint')}</span>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {link.interests.map((i) => {
            const on = interests.includes(i);
            return (
              <button key={i} type="button" aria-pressed={on} onClick={() => toggleInterest(i)}
                className={cn('flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition',
                  on ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                    : 'border-border bg-card text-foreground hover:border-primary/50')}>
                {on && <Check className="h-4 w-4" aria-hidden />}
                {t(INTEREST_KEYS[i])}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field id="tl-parent" label={t('trialLinks.form.parentPhone')} optional={t('trialLinks.form.optional')}>
        <Input id="tl-parent" type="tel" inputMode="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)}
          placeholder="+7 700 000 00 00" maxLength={40} />
      </Field>

      {/* A person never sees this field; a bot fills every field it finds. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <input name="tl_extra" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
      </div>

      <div className="flex items-start gap-2.5">
        <Checkbox id="tl-consent" checked={consent} onCheckedChange={(next) => setConsent(next === true)} className="mt-0.5" />
        <Label htmlFor="tl-consent" className="text-xs font-normal leading-relaxed text-muted-foreground">
          {consentText}{' '}
          <Link to="/privacy" target="_blank" className="underline underline-offset-4">{t('trialLinks.form.privacy')}</Link>
        </Label>
      </div>
      {siteKey && <TurnstileWidget ref={check} siteKey={siteKey} locale={locale} t={t} onToken={setToken} />}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      <Button type="submit" size="lg" className="h-12 w-full text-base font-semibold" disabled={busy || waitingForCheck}>
        {busy ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />{t('trialLinks.form.sending')}</>) : t('trialLinks.form.submit')}
      </Button>
    </form>
  );
}
