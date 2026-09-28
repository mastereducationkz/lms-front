import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { NOTE_LIMIT, stampKz } from '../../lib/classLessonPage';
import type { LessonNote, LessonView, NoteKind } from '../../services/api/classLessons';
import { SessionLost } from '../api';
import { lessons } from '../lessons';

// The lesson page's labels (components/class-lesson/NotesSection.tsx).
const KINDS: Record<NoteKind, { ru: string; en: string; hintRu: string; hintEn: string }> = {
  plan: { ru: 'План урока', en: 'Lesson plan', hintRu: 'Ученики видят.', hintEn: 'Students see it.' },
  summary: { ru: 'Итоги урока', en: 'Lesson recap', hintRu: 'Ученики видят.', hintEn: 'Students see it.' },
  staff: { ru: 'Заметка для команды', en: 'Note for the team', hintRu: 'Видят только сотрудники.', hintEn: 'Staff only.' },
};

/** The plan before the lesson, the plan and recap while it runs, the recap first after it. */
export function noteKinds(view: Pick<LessonView, 'status' | 'viewer'>): NoteKind[] {
  const kinds: NoteKind[] = view.status === 'upcoming' ? ['plan'] : view.status === 'live' ? ['plan', 'summary'] : ['summary', 'plan'];
  if (view.viewer.is_staff) kinds.push('staff');
  return kinds;
}

export default function NotesCard({ view, onSaved }: { view: LessonView; onSaved: (kind: NoteKind, note: LessonNote | null) => void }) {
  const kinds = noteKinds(view).filter((k) => view.viewer.can_edit_notes || view.notes[k]);
  const ru = view.viewer.locale === 'ru';
  if (kinds.length === 0) return <p className="text-xs text-slate-500">{ru ? 'Заметок пока нет.' : 'No notes yet.'}</p>;
  return (
    <div className="space-y-2.5">
      {kinds.map((kind) => <Note key={kind} view={view} kind={kind} note={view.notes[kind] ?? null} onSaved={onSaved} />)}
    </div>
  );
}

function Note({ view, kind, note, onSaved }: {
  view: LessonView; kind: NoteKind; note: LessonNote | null; onSaved: (kind: NoteKind, note: LessonNote | null) => void;
}) {
  const ru = view.viewer.locale === 'ru';
  const t = (r: string, e: string) => (ru ? r : e);
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
      setMessage({ ok: true, text: saved ? t('Сохранено', 'Saved') : t('Удалено', 'Cleared') });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof SessionLost ? t('Войдите снова', 'Sign in again') : (e as Error).message || t('Не удалось сохранить', 'Could not save') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('rounded-lg border p-2.5', kind === 'staff' ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200')}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1 text-xs font-semibold text-slate-900">
          {kind === 'staff' && <Lock className="h-3 w-3 text-amber-600" aria-hidden />}
          {ru ? meta.ru : meta.en}
        </h3>
        {note?.at && <span className="truncate text-[10px] text-slate-500">{note.by ? `${note.by} · ` : ''}{stampKz(note.at, view.viewer.locale)}</span>}
      </div>
      {editable ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setMessage(null); }}
            rows={draft.length > 200 ? 5 : 3}
            placeholder={`${t('Напишите…', 'Write…')} ${ru ? meta.hintRu : meta.hintEn}`}
            aria-label={ru ? meta.ru : meta.en}
            className="mt-1.5 w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className={cn('text-[10px] tabular-nums', over ? 'font-semibold text-rose-600' : 'text-slate-400')}>{draft.length}/{NOTE_LIMIT}</span>
            <span className="flex items-center gap-2">
              {message && <span className={cn('text-[11px]', message.ok ? 'text-emerald-700' : 'text-rose-700')}>{message.text}</span>}
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving || over}
                className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {t('Сохранить', 'Save')}
              </button>
            </span>
          </div>
        </>
      ) : (
        <p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-slate-800">{note?.text}</p>
      )}
    </div>
  );
}
