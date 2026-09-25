import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { setLessonTopic } from '../../services/api/curator';
import type { LessonBrief, MaterialItem } from '../../services/api/classMaterials';
import { suggestTopic, t, type Locale } from '../../lib/classMaterials';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface Props {
  lesson: LessonBrief;
  /** Non-removed items, in position order — the same set `ClassMaterialsSection` renders. */
  visibleItems: MaterialItem[];
  canManage: boolean;
  locale: Locale;
  onSaved: (topic: string) => void;
}

/**
 * D19: the lesson-topic row. Never rendered for a lesson with no linked group, because saving
 * needs `lesson.group_ids[0]`. Before a topic is confirmed, only a manager with at least one
 * item sees the editable suggestion — there is no auto-display of an unconfirmed topic; once
 * confirmed, everyone sees the plain text and only a manager can reopen the editor.
 */
export default function TopicSuggestionRow({ lesson, visibleItems, canManage, locale, onSaved }: Props) {
  const [editing, setEditing] = useState(!lesson.topic);
  const [value, setValue] = useState(() => lesson.topic ?? suggestTopic(visibleItems.map((item) => item.title)));
  const [saving, setSaving] = useState(false);

  if (!lesson.group_ids.length) return null;
  if (!lesson.topic && (!canManage || visibleItems.length === 0)) return null;

  if (!editing) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>
          {t('topicPrefix', locale)}: {lesson.topic}
        </span>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setValue(lesson.topic ?? '');
              setEditing(true);
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t('rename', locale)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const res = await setLessonTopic({
        group_id: lesson.group_ids[0],
        event_id: lesson.id,
        topic: value.trim() || null,
      });
      onSaved(res.topic ?? '');
      setEditing(!res.topic);
    } catch {
      toast.error(t('somethingWrong', locale));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 max-w-sm space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{t('topicLabel', locale)}</label>
      <div className="flex items-center gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} className="h-8 text-sm" />
        <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
          {t('save', locale)}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('topicHint', locale)}</p>
    </div>
  );
}
