import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { NOTE_LIMIT, stampKz } from '../../lib/classLessonPage';
import { t, type MessageKey } from '../../lib/i18n';
import type { LessonNote, LessonView, NoteKind } from '../../services/api/classLessons';
import { SessionLost } from '../api';
import { lessons } from '../lessons';

// The lesson page's labels (components/class-lesson/NotesSection.tsx), with shorter hints. The panel's
// language is set from the lesson's viewer (LessonPanel), so `t` reads it from activeLocale().
const KINDS: Record<NoteKind, { label: MessageKey; hint: MessageKey }> = {
  plan: { label: 'classLesson.notes.plan', hint: 'classLesson.notes.studentsSee' },
  summary: { label: 'classLesson.notes.summary', hint: 'classLesson.notes.studentsSee' },
  staff: { label: 'classLesson.notes.staff', hint: 'classLesson.notes.staffOnly' },
};

/** The plan before the lesson, the plan and recap while it runs, the recap first after it. */
export function noteKinds(view: Pick<LessonView, 'status' | 'viewer'>): NoteKind[] {
  const kinds: NoteKind[] = view.status === 'upcoming' ? ['plan'] : view.status === 'live' ? ['plan', 'summary'] : ['summary', 'plan'];
  if (view.viewer.is_staff) kinds.push('staff');
  return kinds;
}

export default function NotesCard({ view, onSaved }: { view: LessonView; onSaved: (kind: NoteKind, note: LessonNote | null) => void }) {
  const kinds = noteKinds(view).filter((k) => view.viewer.can_edit_notes || view.notes[k]);
  if (kinds.length === 0) return <p className="text-xs text-muted-foreground">{t('classLesson.notes.none')}</p>;
  return (
    <div className="space-y-2.5">
      {kinds.map((kind) => <Note key={kind} view={view} kind={kind} note={view.notes[kind] ?? null} onSaved={onSaved} />)}
    </div>
  );
}

function Note({ view, kind, note, onSaved }: {
  view: LessonView; kind: NoteKind; note: LessonNote | null; onSaved: (kind: NoteKind, note: LessonNote | null) => void;
}) {
  const meta = KINDS[kind];
  const [draft, setDraft] = useState(note?.text ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setDraft(note?.text ?? ''); }, [note?.text]);
  const editable = view.viewer.can_edit_notes;
  const dirty = draft.trim() !== (note?.text ?? '').trim();
  const over = draft.length > NOTE_LIMIT;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await lessons.saveNote(view.id, kind, draft.trim());
      onSaved(kind, saved);
      setMessage({ ok: true, text: saved ? t('classLesson.saved') : t('classLesson.panel.cleared') });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof SessionLost ? t('classLesson.panel.signInAgain') : (e as Error).message || t('classLesson.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('rounded-lg border p-2.5', kind === 'staff' ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/15' : 'border-border')}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1 text-xs font-semibold text-foreground">
          {kind === 'staff' && <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" aria-hidden />}
          {t(meta.label)}
        </h3>
        {note?.at && <span className="truncate text-[10px] text-muted-foreground">{note.by ? `${note.by} · ` : ''}{stampKz(note.at)}</span>}
      </div>
      {editable ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setMessage(null); }}
            rows={draft.length > 200 ? 5 : 3}
            placeholder={t('classLesson.notes.placeholderWithHint', { hint: t(meta.hint) })}
            aria-label={t(meta.label)}
            className="mt-1.5 w-full resize-y rounded-md border border-border bg-card px-2 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className={cn('text-[10px] tabular-nums', over ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>{draft.length}/{NOTE_LIMIT}</span>
            <span className="flex items-center gap-2">
              {message && <span className={cn('text-[11px]', message.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>{message.text}</span>}
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving || over}
                className="inline-flex items-center gap-1 rounded-full bg-brand-solid px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {t('common.save')}
              </button>
            </span>
          </div>
        </>
      ) : (
        <p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-foreground">{note?.text}</p>
      )}
    </div>
  );
}
