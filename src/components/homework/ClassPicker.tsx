import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useT } from '../../lib/i18n/react';
import { classPickerView, type ClassEvent, type ClassesState } from '../../lib/groupClasses';
import '@/lib/i18n/catalogs/homeworkStaff';

/**
 * «Pick a class» of the homework builder, for one group. Every state is on screen: loading, a failed load
 * (with a retry unless it was a refusal), a group with nothing upcoming (and what to do about it), or the
 * list. It used to render an empty list for all of them, and linking a class is mandatory.
 */
export function ClassPicker({ state, value, onChange, onRetry, format }: {
  state: ClassesState;
  /** The picked class id as a string, or ''. */
  value: string;
  onChange: (eventId: number) => void;
  onRetry: () => void;
  format: (event: ClassEvent) => string;
}) {
  const t = useT();
  const view = classPickerView(state, value ? Number(value) : null);

  if (view.kind === 'loading') {
    return <p role="status" className="text-xs text-muted-foreground">{t('homeworkStaff.builder.classesLoading')}</p>;
  }
  if (view.kind === 'error') {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
        <span>{view.forbidden ? t('homeworkStaff.builder.classesForbidden') : t('homeworkStaff.builder.classesLoadFailed')}</span>
        {!view.forbidden && (
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={onRetry}>
            {t('homeworkStaff.builder.classesRetry')}
          </Button>
        )}
      </div>
    );
  }
  if (view.kind === 'empty') {
    return <p role="status" className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">{t('homeworkStaff.builder.classesNone')}</p>;
  }
  return (
    <Select value={value} onValueChange={(next) => onChange(parseInt(next))}>
      <SelectTrigger className="w-full bg-muted dark:bg-secondary border-border h-9 text-xs">
        <SelectValue placeholder={t('homeworkStaff.builder.pickClass')} />
      </SelectTrigger>
      <SelectContent>
        {view.options.map(({ event, held }) => (
          <SelectItem key={event.id} value={event.id.toString()}>
            {format(event)}{held ? ` ${t('homeworkStaff.builder.classHeld')}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
