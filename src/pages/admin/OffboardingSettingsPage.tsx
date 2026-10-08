import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { PersonSelect } from '../../components/offboarding/parts';
import { toast } from '../../components/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useOffboardingConfig } from '../../hooks/useOffboardingConfig';
import { getUsers } from '../../services/api/users';
import {
  PROGRAMMES,
  getOffboardingSettings,
  saveOffboardingSettings,
  type DefaultHeads,
  type OffboardingSettings,
  type Person,
  type Programme,
} from '../../services/api/offboarding';
import { roleLabel } from '../../lib/roleLabel';
import { formatDateTime } from '../../lib/i18n';
import { useLocale, useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

const STAFF = ['admin', 'head_teacher', 'teacher', 'head_curator', 'curator'] as const;
type Heads = Record<Programme, { head_teacher_id: number | null; head_curator_id: number | null }>;

const PROGRAMME_KEY = {
  sat: 'offboarding.programme.sat',
  ielts: 'offboarding.programme.ielts',
  general_english: 'offboarding.programme.general_english',
  nuet: 'offboarding.programme.nuet',
} as const;

function headsOf(settings: OffboardingSettings): Heads {
  const pick = (h?: DefaultHeads) => ({ head_teacher_id: h?.head_teacher_id ?? null, head_curator_id: h?.head_curator_id ?? null });
  return Object.fromEntries(PROGRAMMES.map((p) => [p, pick(settings.default_heads?.[p])])) as Heads;
}

/** Offboarding settings (SPEC §7): default new owners per programme, who is told, who the access review skips. */
export default function OffboardingSettingsPage() {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const config = useOffboardingConfig(user?.role);
  const [settings, setSettings] = useState<OffboardingSettings | null>(null);
  const [heads, setHeads] = useState<Heads | null>(null);
  const [notify, setNotify] = useState<number[]>([]);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [staff, setStaff] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [loaded, ...lists] = await Promise.all([
        getOffboardingSettings(),
        ...STAFF.map((role) => getUsers({ role, is_active: true, limit: 1000 })),
      ]);
      setSettings(loaded);
      setHeads(headsOf(loaded));
      setNotify(loaded.notify_user_ids ?? []);
      setExcluded(loaded.access_review_excluded_user_ids ?? []);
      setStaff(lists.flatMap((l) => l.users ?? []).map((u) => ({ id: Number(u.id), name: u.name || u.full_name || u.email, role: u.role })));
    } catch (e) {
      setError((e instanceof Error && e.message) || t('offboarding.settings.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    if (config?.enabled) load();
  }, [config?.enabled, load]);

  const byRole = useMemo(() => ({
    head_teacher: staff.filter((p) => p.role === 'head_teacher'),
    head_curator: staff.filter((p) => p.role === 'head_curator'),
  }), [staff]);
  const nameOf = useMemo(() => {
    const names = new Map(staff.map((p) => [p.id, p.name]));
    settings?.notify_users?.forEach((p) => names.set(p.id, p.name));
    PROGRAMMES.forEach((p) => {
      const h = settings?.default_heads?.[p];
      if (h?.head_teacher_id && h.head_teacher_name) names.set(h.head_teacher_id, h.head_teacher_name);
      if (h?.head_curator_id && h.head_curator_name) names.set(h.head_curator_id, h.head_curator_name);
    });
    return (id: number) => names.get(id) ?? t('offboarding.settings.unknownUser', { id });
  }, [staff, settings, t]);
  const staffWithRoles = useMemo(() => staff.map((p) => ({ ...p, name: `${p.name} · ${roleLabel(p.role, locale)}` })), [staff, locale]);

  const save = async () => {
    if (!heads) return;
    setSaving(true);
    try {
      const saved = await saveOffboardingSettings({ default_heads: heads, notify_user_ids: notify, access_review_excluded_user_ids: excluded });
      setSettings(saved);
      setHeads(headsOf(saved));
      setNotify(saved.notify_user_ids ?? []);
      setExcluded(saved.access_review_excluded_user_ids ?? []);
      toast(t('offboarding.settings.saved'), 'success');
    } catch (e) {
      toast((e instanceof Error && e.message) || t('offboarding.settings.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (config && !config.enabled) {
    return <p className="p-6 text-sm text-muted-foreground">{t('offboarding.page.disabled')}</p>;
  }

  const setHead = (programme: Programme, field: 'head_teacher_id' | 'head_curator_id', id: number | null) =>
    setHeads((h) => (h ? { ...h, [programme]: { ...h[programme], [field]: id } } : h));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" asChild className="-ml-2 w-fit pl-0 text-muted-foreground">
        <Link to="/admin/offboarding"><ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />{t('offboarding.record.back')}</Link>
      </Button>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('offboarding.settings.title')}</h1>
        {settings?.updated_at && (
          <p className="text-sm text-muted-foreground">{t('offboarding.settings.updated', { name: settings.updated_by ?? '—', date: formatDateTime(settings.updated_at) })}</p>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {heads && (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="font-semibold text-foreground">{t('offboarding.settings.defaultsTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('offboarding.settings.defaultsIntro')}</p>
            </div>
            <div className="divide-y divide-border rounded-md border border-border">
              {PROGRAMMES.map((programme) => (
                <div key={programme} className="grid gap-2 p-3 sm:grid-cols-[10rem_1fr_1fr] sm:items-center">
                  <div className="text-sm font-medium text-foreground">{t(PROGRAMME_KEY[programme])}</div>
                  {(['head_teacher_id', 'head_curator_id'] as const).map((field) => {
                    const people = field === 'head_teacher_id' ? byRole.head_teacher : byRole.head_curator;
                    const value = heads[programme][field];
                    const label = t(field === 'head_teacher_id' ? 'offboarding.settings.headTeacher' : 'offboarding.settings.headCurator');
                    return (
                      <div key={field} className="flex items-center gap-1">
                        <PersonSelect
                          people={value != null && !people.some((p) => p.id === value) ? [{ id: value, name: nameOf(value) }, ...people] : people}
                          value={value}
                          onChange={(id) => setHead(programme, field, id)}
                          placeholder={`${label}: ${t('offboarding.settings.nobody')}`}
                          ariaLabel={`${t(PROGRAMME_KEY[programme])}: ${label}`}
                          className="w-full"
                        />
                        {/* Always laid out, so the two columns line up whether or not someone is set. */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={value == null ? 'invisible' : ''}
                          aria-label={value == null ? undefined : t('offboarding.settings.remove', { name: nameOf(value) })}
                          onClick={() => setHead(programme, field, null)}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          <PeopleList
            title={t('offboarding.settings.notifyTitle')}
            intro={t('offboarding.settings.notifyIntro')}
            ids={notify}
            onChange={setNotify}
            people={staffWithRoles}
            nameOf={nameOf}
          />
          <PeopleList
            title={t('offboarding.settings.excludedTitle')}
            intro={t('offboarding.settings.excludedIntro')}
            ids={excluded}
            onChange={setExcluded}
            people={staffWithRoles}
            nameOf={nameOf}
          />

          <Button onClick={save} disabled={saving}>{saving ? t('offboarding.settings.saving') : t('offboarding.settings.save')}</Button>
        </>
      )}
    </div>
  );
}

interface PeopleListProps {
  title: string;
  intro: string;
  ids: number[];
  onChange: (ids: number[]) => void;
  people: Person[];
  nameOf: (id: number) => string;
}

function PeopleList({ title, intro, ids, onChange, people, nameOf }: PeopleListProps) {
  const t = useT();
  const addable = people.filter((p) => !ids.includes(p.id));
  return (
    <section className="space-y-2">
      <div>
        <h2 className="font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </div>
      {ids.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('offboarding.settings.empty')}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {ids.map((id) => (
            <li key={id} className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-3 pr-1 text-sm text-foreground">
              {nameOf(id)}
              <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t('offboarding.settings.remove', { name: nameOf(id) })} onClick={() => onChange(ids.filter((x) => x !== id))}>
                <X className="h-3 w-3" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <PersonSelect
        people={addable}
        value={null}
        onChange={(id) => onChange([...ids, id])}
        placeholder={t('offboarding.settings.addPerson')}
        className="w-full sm:w-80"
      />
    </section>
  );
}
