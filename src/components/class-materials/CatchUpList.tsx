import { useEffect, useState } from 'react';
import { getClassMaterialsCatchUp } from '../../services/api/classMaterials';
import { t, type Locale } from '../../lib/classMaterials';

interface Props {
  eventId: number;
  locale: Locale;
}

/**
 * The curator/moderator line: students marked absent from this lesson who haven't opened any
 * of its materials yet (D14). Silent on any failure and — the common case, once everyone has
 * caught up — when the list comes back empty; there is nothing here a viewer needs an error
 * for.
 */
export default function CatchUpList({ eventId, locale }: Props) {
  const [names, setNames] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setNames(null);
    getClassMaterialsCatchUp(eventId)
      .then((res) => {
        if (!cancelled) setNames(res.students.map((s) => s.name));
      })
      .catch(() => {
        if (!cancelled) setNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!names || names.length === 0) return null;

  return (
    <div className="mt-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{t('catchUp', locale)}: </span>
      {names.join(', ')}
    </div>
  );
}
