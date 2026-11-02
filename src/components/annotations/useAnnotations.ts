/**
 * The viewer's own annotations on one target, with optimistic changes: a highlight shows the
 * moment a colour is tapped and quietly rolls back (with a toast) if the server refuses it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAnnotation, deleteAnnotation, listAnnotations, updateAnnotation,
  type AnnotationSurface, type NewAnnotation, type TextAnnotation,
} from '../../services/api/annotations';
import type { AnnotationColor } from '../../lib/annotations/paint';
import { reportError } from '../../lib/sentry';
import { toast } from '../Toast';
import { t } from '../../lib/i18n';
import '@/lib/i18n/catalogs/lessonPlayer';

let tempIds = -1;

export function useAnnotations(
  surface: AnnotationSurface,
  targetId: number | null | undefined,
  attempt: 'current' | 'latest',
  enabled: boolean,
) {
  const [items, setItems] = useState<TextAnnotation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  // A highlight still being created: edits to it wait for its real id.
  const pending = useRef(new Map<number, Promise<TextAnnotation | null>>());

  useEffect(() => {
    setItems([]);
    setLoaded(false);
    if (!enabled || !targetId) return;
    let cancelled = false;
    listAnnotations(surface, targetId, attempt)
      .then((data) => { if (!cancelled) setItems(data.annotations || []); })
      .catch((error) => { if (!cancelled) reportError(error, { where: 'annotations.list', surface }); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [surface, targetId, attempt, enabled, version]);

  const failed = useCallback((error: unknown, where: string) => {
    reportError(error, { where, surface });
    toast(t('lessonPlayer.annotate.saveFailed'), 'error');
  }, [surface]);

  const realId = useCallback(async (id: number): Promise<number | null> => {
    if (id > 0) return id;
    const created = await pending.current.get(id);
    return created ? created.id : null;
  }, []);

  const create = useCallback((body: NewAnnotation): number => {
    if (!targetId) return 0;
    const tempId = tempIds--;
    const optimistic: TextAnnotation = { ...body, id: tempId, note: body.note ?? null, attempt_no: 0 };
    setItems((prev) => [...prev, optimistic]);
    const request = createAnnotation(surface, targetId, body)
      .then((row) => {
        setItems((prev) => prev.map((a) => (a.id === tempId ? row : a)));
        return row;
      })
      .catch((error) => {
        setItems((prev) => prev.filter((a) => a.id !== tempId));
        failed(error, 'annotations.create');
        return null;
      })
      .finally(() => { pending.current.delete(tempId); });
    pending.current.set(tempId, request);
    return tempId;
  }, [surface, targetId, failed]);

  const update = useCallback((id: number, patch: { color?: AnnotationColor; note?: string | null }) => {
    let before: TextAnnotation | undefined;
    setItems((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      before = a;
      return { ...a, ...patch, note: patch.note === undefined ? a.note : patch.note || null };
    }));
    void (async () => {
      try {
        const real = await realId(id);
        if (!real) return;
        const row = await updateAnnotation(real, patch);
        setItems((prev) => prev.map((a) => (a.id === id || a.id === real ? row : a)));
      } catch (error) {
        if (before) setItems((prev) => prev.map((a) => (a.id === id ? before! : a)));
        failed(error, 'annotations.update');
      }
    })();
  }, [realId, failed]);

  const remove = useCallback((id: number) => {
    let removed: TextAnnotation | undefined;
    setItems((prev) => prev.filter((a) => {
      if (a.id === id) removed = a;
      return a.id !== id;
    }));
    void (async () => {
      try {
        const real = await realId(id);
        if (real) await deleteAnnotation(real);
      } catch (error) {
        if (removed) setItems((prev) => [...prev, removed!]);
        failed(error, 'annotations.delete');
      }
    })();
  }, [realId, failed]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { items, loaded, create, update, remove, reload };
}
