import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import apiClient from '../../../services/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { toast } from '../../Toast';
import { useT } from '../../../lib/i18n/react';
import { hasMessage } from '../../../lib/i18n/translate';
import type { Course } from '../../../types';
import { PublicApiError } from '../../../services/api/publicWebinars';
import { saveTrialLinkSettings, type Programme, type TemplateItem, type TrialLinkSettings } from '../../../services/api/trialLinks';
import TemplateEditor from './TemplateEditor';
import '@/lib/i18n/catalogs/trialLinks';

const PROGRAMMES: Programme[] = ['sat', 'ielts', 'nuet'];

function serverMessage(error: unknown): string | null {
  const data = (error as { response?: { data?: { detail?: unknown } } })?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  return error instanceof PublicApiError ? error.message : null;
}

function Switch({ title, help, on, onText, offText, busy, disabled, onToggle }: {
  title: string; help: string; on: boolean; onText: string; offText: string; busy: boolean; disabled: boolean; onToggle: () => void;
}) {
  return (
    <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="max-w-xl">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className={`h-2 w-2 rounded-full ${on ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />{title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{help}</p>
      </div>
      {!disabled && (
        <Button variant={on ? 'outline' : 'default'} onClick={onToggle} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}{on ? offText : onText}
        </Button>
      )}
    </section>
  );
}

export default function SettingsTab({ settings, canEdit, onSaved }: {
  settings: TrialLinkSettings | null; canEdit: boolean; onSaved: (next: TrialLinkSettings) => void;
}) {
  const t = useT();
  const [courses, setCourses] = useState<Course[]>([]);
  const [draft, setDraft] = useState<TrialLinkSettings | null>(settings);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { setDraft(settings); }, [settings]);
  useEffect(() => { if (canEdit) apiClient.getCourses().then(setCourses).catch(() => undefined); }, [canEdit]);

  if (!draft) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />;

  const save = async (what: string, body: Parameters<typeof saveTrialLinkSettings>[0]) => {
    setBusy(what);
    try {
      onSaved(await saveTrialLinkSettings(body));
      toast(t('trialLinks.admin.saved'), 'success');
    } catch (error) {
      const msg = serverMessage(error);
      toast(msg ?? t('trialLinks.admin.saveFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const templatesBody = () => Object.fromEntries(PROGRAMMES.map((p) => [p, draft.templates[p].map((i) => ({ course_id: i.course_id, lesson_ids: i.lesson_ids }))])) as Record<Programme, { course_id: number; lesson_ids: number[] }[]>;
  const setTemplate = (p: Programme, items: TemplateItem[]) => setDraft({ ...draft, templates: { ...draft.templates, [p]: items } });
  const missing = draft.missing_programmes.map((p) => (hasMessage(`trialLinks.settings.programme.${p}`) ? t(`trialLinks.settings.programme.${p}`) : p)).join(', ');

  return (
    <div className="space-y-5">
      {!canEdit && <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{t('trialLinks.settings.readOnly')}</p>}
      {!draft.policy_ready && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{t('trialLinks.settings.policyMissing')}</p>}
      {draft.missing_programmes.length > 0 && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{t('trialLinks.settings.missing', { list: missing })}</p>
      )}

      <Switch title={t('trialLinks.settings.signups')} help={t('trialLinks.settings.signupsHelp')} on={draft.signups_open}
        onText={t('trialLinks.settings.open')} offText={t('trialLinks.settings.close')} busy={busy === 'signups'} disabled={!canEdit}
        onToggle={() => save('signups', { signups_open: !draft.signups_open })} />
      <Switch title={t('trialLinks.settings.amo')} help={t('trialLinks.settings.amoHelp')} on={draft.leads_enabled}
        onText={t('trialLinks.settings.amoOn')} offText={t('trialLinks.settings.amoOff')} busy={busy === 'amo'} disabled={!canEdit}
        onToggle={() => save('amo', { leads_enabled: !draft.leads_enabled })} />

      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="max-w-[12rem] space-y-1">
          <Label htmlFor="tl-days">{t('trialLinks.settings.days')}</Label>
          <Input id="tl-days" type="number" min={1} max={60} value={draft.days} disabled={!canEdit}
            onChange={(e) => setDraft({ ...draft, days: Number(e.target.value) || 1 })} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t('trialLinks.settings.templates')}</h3>
          <p className="mb-3 text-sm text-muted-foreground">{t('trialLinks.settings.templatesHelp')}</p>
          <div className="grid gap-4 @5xl:grid-cols-3">
            {PROGRAMMES.map((p) => (
              <div key={p} className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">{t(`trialLinks.settings.programme.${p}`)}</p>
                <TemplateEditor items={draft.templates[p]} courses={courses} disabled={!canEdit} onChange={(items) => setTemplate(p, items)} />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 @3xl:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="tl-consent-ru">{t('trialLinks.settings.consent')} · {t('trialLinks.settings.consentRu')}</Label>
            <Textarea id="tl-consent-ru" rows={4} value={draft.consent_text_ru} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, consent_text_ru: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tl-consent-en">{t('trialLinks.settings.consent')} · {t('trialLinks.settings.consentEn')}</Label>
            <Textarea id="tl-consent-en" rows={4} value={draft.consent_text_en} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, consent_text_en: e.target.value })} />
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => save('main', { days: draft.days, templates: templatesBody(), consent_text_ru: draft.consent_text_ru, consent_text_en: draft.consent_text_en })}
            disabled={busy === 'main'}>
            {busy === 'main' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}{t('trialLinks.settings.save')}
          </Button>
        )}
      </section>
    </div>
  );
}
