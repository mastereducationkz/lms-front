import { useMemo } from 'react';
import { Label } from '../ui/label';
import { SearchableSelect, type SearchableOption } from '../ui/searchable-select';
import { roleLabel } from '@/lib/roleLabel';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/adminPages';

interface Host {
  id: number;
  name?: string;
  role?: string;
  /** False: no Workspace account is linked. Absent (an older list) says nothing. */
  has_workspace?: boolean;
}

interface Props {
  hosts: Host[];
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  /** A webinar / office hour has a host; a class lesson has a teacher. Same field, its own words. */
  webinar?: boolean;
  /** The list of staff could not be loaded: say so instead of showing a dropdown that holds only «none». */
  loadFailed?: boolean;
}

const NONE = 'none';

/**
 * Who runs the event. For a webinar this is the only place the host is set: pay, the Meet room and the
 * calendar's «Host» line all follow `teacher_id`. On a series, the form's «this and following» switch
 * carries a changed host to every later week. Searchable, because the list is every active staff member.
 * A person without a linked Workspace account is marked: no Meet room is created for what they run.
 */
export default function EventHostField({ hosts, value, onChange, webinar = false, loadFailed = false }: Props) {
  const t = useT();
  const options = useMemo<SearchableOption[]>(() => [
    { value: NONE, label: t(webinar ? 'adminPages.events.form.noHost' : 'adminPages.events.form.noTeacher') },
    ...hosts.map((host) => ({
      value: host.id.toString(),
      label: host.name ?? `#${host.id}`,
      hint: [roleLabel(host.role), host.has_workspace === false ? t('adminPages.events.form.noWorkspace') : null]
        .filter(Boolean).join(' · '),
    })),
  ], [hosts, t, webinar]);
  const chosen = value ? hosts.find((host) => host.id === value) : undefined;

  return (
    <div>
      <Label htmlFor="teacher_id">{t(webinar ? 'adminPages.events.form.host' : 'adminPages.events.form.teacher')}</Label>
      <SearchableSelect
        id="teacher_id"
        className="w-full"
        options={options}
        value={value ? value.toString() : NONE}
        onChange={(next) => onChange(next === NONE ? undefined : parseInt(next))}
        placeholder={t(webinar ? 'adminPages.events.form.selectHost' : 'adminPages.events.form.selectTeacher')}
      />
      {loadFailed && <p role="alert" className="mt-1.5 text-xs text-destructive">{t('adminPages.events.form.hostsFailed')}</p>}
      {chosen?.has_workspace === false && (
        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">{t('adminPages.events.form.noWorkspaceWarning')}</p>
      )}
      {webinar && <p className="mt-1.5 text-xs text-muted-foreground">{t('adminPages.events.form.hostHint')}</p>}
    </div>
  );
}
