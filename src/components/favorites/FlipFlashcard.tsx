/**
 * A saved flashcard on «My Flashcards» that turns over in 3D on click, Enter or Space (450 ms;
 * a cross-fade under prefers-reduced-motion). The back of a Look Up card carries everything the
 * save stored: the translation, the definition and the sentence the word came from.
 */
import type { MouseEvent, ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import type { FlashcardItem } from '../../types';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/learning';
import './FlipFlashcard.css';

/** Look Up saves (POST /flashcards/quick_create) store these next to the FlashcardItem fields. */
export type SavedFlashcard = FlashcardItem & {
  definition?: string | null;
  context?: string | null;
  phonetic?: string | null;
  source?: string | null;
};

/**
 * Teacher-made lesson cards are marked easy or hard; every Look Up save is "normal", which tells
 * the student nothing, so only easy and hard get a badge.
 */
export function DifficultyBadge({ difficulty, className = '' }: { difficulty?: string; className?: string }) {
  const t = useT();
  if (difficulty === 'easy') {
    return <Badge className={`border-transparent bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-200 ${className}`}>{t('learning.flashcards.easy')}</Badge>;
  }
  if (difficulty === 'hard') {
    return <Badge className={`border-transparent bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-200 ${className}`}>{t('learning.flashcards.hard')}</Badge>;
  }
  return null;
}

/** The sentence the word was saved from, with the word itself picked out. */
function ContextSentence({ text, word, clamp }: { text: string; word: string; clamp: boolean }) {
  const needle = word.trim();
  const parts: ReactNode[] = [];
  if (needle) {
    const re = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    text.split(re).forEach((part, i) => {
      parts.push(i % 2 === 1 ? <strong key={i} className="font-semibold not-italic text-foreground">{part}</strong> : part);
    });
  } else {
    parts.push(text);
  }
  return <p className={`text-sm italic leading-relaxed text-muted-foreground ${clamp ? 'line-clamp-2' : ''}`}>“{parts}”</p>;
}

/** Definition + example sentence of a Look Up card (clamped on the small card); nothing for a plain card. */
export function LookupDetails({ card, clamp = true, className = '' }: { card: SavedFlashcard; clamp?: boolean; className?: string }) {
  if (!card.definition && !card.context) return null;
  return (
    <div className={`space-y-2 ${className}`}>
      {card.definition && <p className={`text-sm leading-relaxed text-foreground/85 ${clamp ? 'line-clamp-2' : ''}`}>{card.definition}</p>}
      {card.context && <ContextSentence text={card.context} word={card.front_text} clamp={clamp} />}
    </div>
  );
}

interface FlipFlashcardProps {
  card: SavedFlashcard;
  flipped: boolean;
  onFlip: () => void;
  onRemove: (event: MouseEvent) => void;
}

export default function FlipFlashcard({ card, flipped, onFlip, onRemove }: FlipFlashcardProps) {
  const t = useT();
  const rich = Boolean(card.definition || card.context);
  const tags = card.tags ?? [];
  const face = 'flip-card__face flex flex-col rounded-xl border bg-card p-6 text-card-foreground shadow-sm transition-shadow group-hover:shadow-lg';
  return (
    <div className="group relative h-72">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        className="flip-card h-full cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={onFlip}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onFlip();
        }}
      >
        <div className="flip-card__inner">
          {/* Front: the word (and how it sounds), the difficulty a teacher set, the tags. */}
          <div className={`${face} flip-card__front items-center text-center`} aria-hidden={flipped}>
            <div className="flex h-6 w-full items-start">
              <DifficultyBadge difficulty={card.difficulty} className="text-xs" />
            </div>
            <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2">
              {card.front_image_url && (
                <img src={card.front_image_url} alt={t('learning.flashcards.frontImage')} className="mx-auto max-h-24 max-w-full rounded object-contain" />
              )}
              <div className="line-clamp-3 px-2 text-2xl font-semibold leading-tight text-foreground [overflow-wrap:anywhere]">
                {card.front_text}
              </div>
              {card.phonetic && <div className="text-sm text-muted-foreground">{card.phonetic}</div>}
            </div>
            {tags.length > 0 && (
              <div className="mb-2 flex flex-wrap justify-center gap-1">
                {tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs font-medium text-muted-foreground">{tag}</Badge>
                ))}
                {tags.length > 2 && <Badge variant="outline" className="text-xs font-medium text-muted-foreground">+{tags.length - 2}</Badge>}
              </div>
            )}
            <div className="text-xs text-muted-foreground">{t('learning.flashcards.reveal')}</div>
          </div>

          {/* Back: the answer; a Look Up card adds its definition and the sentence it came from. */}
          <div className={`${face} flip-card__back ${rich ? 'text-left' : 'items-center text-center'}`} aria-hidden={!flipped}>
            <div className={`flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden ${rich ? 'justify-start' : 'items-center justify-center'}`}>
              {rich && <div className="truncate pr-8 text-sm font-medium text-muted-foreground">{card.front_text}</div>}
              {card.back_image_url && (
                <img src={card.back_image_url} alt={t('learning.flashcards.backImage')} className="mx-auto max-h-24 max-w-full rounded object-contain" />
              )}
              <div className={`font-semibold leading-tight text-foreground [overflow-wrap:anywhere] ${rich ? 'line-clamp-2 text-xl' : 'line-clamp-3 px-2 text-2xl'}`}>
                {card.back_text}
              </div>
              <LookupDetails card={card} />
            </div>
            <div className={`pt-2 text-xs text-muted-foreground ${rich ? '' : 'text-center'}`}>{t('learning.flashcards.flipBack')}</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={t('learning.flashcards.remove')}
        title={t('learning.flashcards.remove')}
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-red-600 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300 [@media(hover:none)]:opacity-100"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
