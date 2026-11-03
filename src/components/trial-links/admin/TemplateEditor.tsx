import { useEffect, useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../../services/api';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { NativeSelect } from '../../ui/native-select';
import Loader from '../../Loader';
import { useT } from '../../../lib/i18n/react';
import type { Course, CourseModule } from '../../../types';
import type { TemplateItem } from '../../../services/api/trialLinks';
import '@/lib/i18n/catalogs/trialLinks';

function CourseLessons({ item, courses, disabled, onChange, onRemove }: {
  item: TemplateItem; courses: Course[]; disabled: boolean; onChange: (next: TemplateItem) => void; onRemove: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(item.lesson_ids.length === 0);
  const [modules, setModules] = useState<CourseModule[] | null>(null);
  const title = item.course_title ?? courses.find((c) => Number(c.id) === item.course_id)?.title ?? `#${item.course_id}`;

  useEffect(() => {
    if (!open || modules) return;
    apiClient.getCourseModules(String(item.course_id), true).then(setModules).catch(() => setModules([]));
  }, [open, modules, item.course_id]);

  const chosen = new Set(item.lesson_ids);
  const toggle = (ids: number[], on: boolean) => {
    const next = new Set(chosen);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    onChange({ ...item, lesson_ids: [...next].sort((a, b) => a - b) });
  };

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden />
          <span className="truncate text-sm font-medium text-foreground">{title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{t('trialLinks.settings.lessons', { count: item.lesson_ids.length })}</span>
        </button>
        {!disabled && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        )}
      </div>
      {open && (
        <div className="max-h-64 overflow-y-auto border-t border-border">
          {!modules ? <div className="flex justify-center py-6"><Loader size="sm" /></div> : modules.map((m) => {
            const lessons = (m.lessons || []).map((l) => Number(l.id));
            const all = lessons.length > 0 && lessons.every((id) => chosen.has(id));
            return (
              <div key={m.id} className="border-b border-border/60 last:border-0">
                <label className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/80">
                  <Checkbox checked={all} disabled={disabled} onCheckedChange={(v) => toggle(lessons, v === true)} />{m.title}
                </label>
                {(m.lessons || []).map((l) => (
                  <label key={l.id} className="flex items-center gap-2 py-1.5 pl-8 pr-3 text-sm hover:bg-muted/50">
                    <Checkbox checked={chosen.has(Number(l.id))} disabled={disabled} onCheckedChange={(v) => toggle([Number(l.id)], v === true)} />
                    {l.title}
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TemplateEditor({ items, courses, disabled, onChange }: {
  items: TemplateItem[]; courses: Course[]; disabled: boolean; onChange: (next: TemplateItem[]) => void;
}) {
  const t = useT();
  const [adding, setAdding] = useState('');
  const used = new Set(items.map((i) => i.course_id));

  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-muted-foreground">{t('trialLinks.settings.noCourses')}</p>}
      {items.map((item, idx) => (
        <CourseLessons key={item.course_id} item={item} courses={courses} disabled={disabled}
          onChange={(next) => onChange(items.map((x, i) => (i === idx ? next : x)))}
          onRemove={() => onChange(items.filter((_, i) => i !== idx))} />
      ))}
      {!disabled && (
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <NativeSelect value={adding} onValueChange={setAdding} searchable placeholder={t('trialLinks.settings.addCourse')}>
              <option value="">—</option>
              {courses.filter((c) => !used.has(Number(c.id))).map((c) => <option key={c.id} value={String(c.id)}>{c.title}</option>)}
            </NativeSelect>
          </div>
          <Button type="button" variant="outline" disabled={!adding}
            onClick={() => { onChange([...items, { course_id: Number(adding), lesson_ids: [] }]); setAdding(''); }}>
            <Plus className="mr-1 h-4 w-4" aria-hidden />{t('trialLinks.settings.addCourse')}
          </Button>
        </div>
      )}
    </div>
  );
}
