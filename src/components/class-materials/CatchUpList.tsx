import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getClassMaterialsCatchUp } from '../../services/api/classMaterials';
import { t, type Locale } from '../../lib/classMaterials';

interface Props {
  eventId: number;
  locale: Locale;
}

/**
 * The curator/moderator line: students marked absent from this lesson who haven't opened any
 * of its materials yet (D14), each linking to their student card (§8.4). Silent on any failure
 * and — the common case, once everyone has caught up — when the list comes back empty; there
 * is nothing here a viewer needs an error for.
 *
 * `/curator/students/:id` admits curator, head_curator, head_teacher and admin — exactly who
 * the backend shows this list to (`can_see_catch_up`: the group's curator or a moderator).
 */
export default function CatchUpList({ eventId, locale }: Props) {
  const [students, setStudents] = useState<{ id: number; name: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStudents(null);
    getClassMaterialsCatchUp(eventId)
      .then((res) => {
        if (!cancelled) setStudents(res.students);
      })
      .catch(() => {
        if (!cancelled) setStudents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!students || students.length === 0) return null;

  return (
    <div className="mt-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{t('catchUp', locale)}: </span>
      {students.map((student, index) => (
        <Fragment key={student.id}>
          {index > 0 && ', '}
          <Link
            to={`/curator/students/${student.id}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {student.name}
          </Link>
        </Fragment>
      ))}
    </div>
  );
}
