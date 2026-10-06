import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from '../Toast';
import { NOTE_LIMIT, stampKz } from '../../lib/classLessonPage';
import { saveLessonNote, type LessonNote, type LessonView, type NoteKind } from '../../services/api/classLessons';

const KINDS: Record<NoteKind, { ru: string; en: string; hintRu: string; hintEn: string }> = {
  plan: {
    ru: 'План урока', en: 'Lesson plan',
    hintRu: 'Что будем проходить и что подготовить. Ученики видят.', hintEn: 'What the lesson covers and what to prepare. Students see it.',
  },
  summary: {
    ru: 'Итоги урока', en: 'Lesson recap',
    hintRu: 'Что прошли и что повторить. Ученики видят.', hintEn: 'What was covered and what to review. Students see it.',
  },
  staff: {
    ru: 'Заметка для команды', en: 'Note for the team',
    hintRu: 'Поведение, проблемы, договорённости. Видят только сотрудники.', hintEn: 'Behaviour, issues, agreements. Staff only.',
  },
};

/** The notes in the order the lesson's state calls for: the plan before it, the recap after it. */
function kindsFor(view: LessonView): NoteKind[] {
  const kinds: NoteKind[] = view.status === 'upcoming' ? ['plan'] : view.status === 'live' ? ['plan', 'summary'] : ['summary', 'plan'];
  if (view.viewer.is_staff) kinds.push('staff');
  return kinds;
}

/**
 * «План урока», «Итоги урока» and «Заметка для команды» (owner, 2026-09-28). Whoever teaches the
 * lesson writes them (heads and admins too); students of the group read the plan and the recap; the
 * team note never leaves the staff. Plain text, links kept as written, 3000 characters.
 */
export default function NotesSection({ view, onSaved }: { view: LessonView; onSaved: (kind: NoteKind, note: LessonNote | null) => void }) {
  const kinds = kindsFor(view).filter((k) => view.viewer.can_edit_notes || view.notes[k]);
  const ru = view.viewer.locale === 'ru';
  if (kinds.length === 0) {
    return <p className="text-sm text-muted-foreground">{ru ? 'Заметок пока нет.' : 'No notes yet.'}</p>;
  }
  return (
    <div className="space-y-4">
      {kinds.map((kind) => (
        <NoteBlock key={kind} view={view} kind={kind} note={view.notes[kind] ?? null} onSaved={onSaved} />
      ))}
    </div>
  );
}

function NoteBlock({ view, kind, note, onSaved }: {
  view: LessonView; kind: NoteKind; note: LessonNote | null; onSaved: (kind: NoteKind, note: LessonNote | null) => void;
}) {
  const ru = view.viewer.locale === 'ru';
  const t = (r: string, e: string) => (ru ? r : e);
  const meta = KINDS[kind];
  const [draft, setDraft] = useState(note?.text ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(note?.text ?? ''); }, [note?.text]);
  const editable = view.viewer.can_edit_notes;
  const dirty = draft.trim() !== (note?.text ?? '').trim();
  const over = draft.length > NOTE_LIMIT;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveLessonNote(view.id, kind, draft.trim());
      onSaved(kind, saved);
      toast(saved ? t('Заметка сохранена', 'Note saved') : t('Заметка удалена', 'Note cleared'), 'success');
    } catch (e) {
      toast((e as Error).message || t('Не удалось сохранить', 'Could not save'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('rounded-xl border p-3', kind === 'staff' ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20' : 'border-border')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {kind === 'staff' && <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />}
          {ru ? meta.ru : meta.en}
        </h3>
        {note?.at && (
          <span className="text-[11px] text-muted-foreground">
            {note.by ? `${note.by} · ` : ''}{stampKz(note.at, view.viewer.locale)}
          </span>
        )}
      </div>
      {editable ? (
        <>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{ru ? meta.hintRu : meta.hintEn}</p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={draft.length > 240 ? 6 : 3}
            className="mt-2 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={t('Напишите…', 'Write…')}
            aria-label={ru ? meta.ru : meta.en}
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className={cn('text-[11px] tabular-nums', over ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
              {draft.length}/{NOTE_LIMIT}
            </span>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving || over}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t('Сохранить', 'Save')}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground">{linkify(note?.text ?? '')}</p>
      )}
    </div>
  );
}

/** Links in a note stay clickable; nothing else is interpreted. */
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => (/^https?:\/\//.test(part)
    ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">{part}</a>
    : <span key={i}>{part}</span>));
}
