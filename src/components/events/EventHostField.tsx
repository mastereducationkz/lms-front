import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { roleLabel } from '@/lib/roleLabel';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/adminPages';

interface Host {
  id: number;
  name?: string;
  role?: string;
}

interface Props {
  hosts: Host[];
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  /** A webinar / office hour has a host; a class lesson has a teacher. Same field, its own words. */
  webinar?: boolean;
}

/**
 * Who runs the event. For a webinar this is the only place the host is set: pay, the Meet room and the
 * calendar's «Host» line all follow `teacher_id`. On a series, the form's «this and following» switch
 * carries a changed host to every later week.
 */
export default function EventHostField({ hosts, value, onChange, webinar = false }: Props) {
  const t = useT();
  return (
    <div>
      <Label htmlFor="teacher_id">{t(webinar ? 'adminPages.events.form.host' : 'adminPages.events.form.teacher')}</Label>
      <Select
        value={value?.toString() || 'none'}
        onValueChange={(next) => onChange(next === 'none' ? undefined : parseInt(next))}
      >
        <SelectTrigger id="teacher_id">
          <SelectValue placeholder={t(webinar ? 'adminPages.events.form.selectHost' : 'adminPages.events.form.selectTeacher')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t(webinar ? 'adminPages.events.form.noHost' : 'adminPages.events.form.noTeacher')}</SelectItem>
          {hosts.map((host) => (
            <SelectItem key={host.id} value={host.id.toString()}>
              {host.name} ({roleLabel(host.role)})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {webinar && <p className="mt-1.5 text-xs text-muted-foreground">{t('adminPages.events.form.hostHint')}</p>}
    </div>
  );
}
