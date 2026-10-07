/**
 * «Still learning» also keeps the card in My Flashcards (owner Q25, 2026-10-07). The first tap on
 * a card during a visit saves it through the favourites endpoint. Later taps on the same card, and
 * a card that is already saved, do nothing. A failed save never stops the round: it goes to Sentry
 * quietly and the student carries on.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { addFavoriteFlashcard } from '../../services/api';
import { reportError } from '../../lib/sentry';
import type { FlashcardItem } from '../../types';

/** How long the quiet "Saved to My Flashcards" note stays. */
export const SAVED_NOTE_MS = 2500;

/** The favourites endpoint answers 400 "Flashcard already in favorites" for a card already saved. */
const ALREADY_SAVED = /already in favorites/i;

interface Where {
  stepId?: number;
  lessonId?: number;
  courseId?: number;
}

export function useStillLearningSave({ stepId, lessonId, courseId }: Where) {
  // Cards a "Still learning" tap already handled this visit, saved or not.
  const handled = useRef(new Set<string>());
  // What we know about each card being in My Flashcards (from the heart button's check).
  const known = useRef(new Map<string, boolean>());
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (savedAt === null) return undefined;
    const timer = window.setTimeout(() => setSavedAt(null), SAVED_NOTE_MS);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  /** Record what the favourite check (or the heart button) found for a card. */
  const remember = useCallback((cardId: string, saved: boolean) => {
    known.current.set(cardId, saved);
  }, []);

  /** Call on "Still learning": saves the card the first time, and only if it isn't saved yet. */
  const keep = useCallback((card: FlashcardItem) => {
    if (!stepId || handled.current.has(card.id)) return;
    handled.current.add(card.id);
    if (known.current.get(card.id)) return;
    addFavoriteFlashcard({
      step_id: stepId,
      flashcard_id: card.id,
      lesson_id: lessonId,
      course_id: courseId,
      flashcard_data: JSON.stringify(card),
    })
      .then(() => {
        known.current.set(card.id, true);
        setSavedAt(Date.now());
      })
      .catch((error: unknown) => {
        if (error instanceof Error && ALREADY_SAVED.test(error.message)) {
          known.current.set(card.id, true);
          return;
        }
        reportError(error, { feature: 'flashcards', action: 'still_learning_save', step_id: stepId });
      });
  }, [stepId, lessonId, courseId]);

  return { keep, remember, saved: savedAt !== null };
}
