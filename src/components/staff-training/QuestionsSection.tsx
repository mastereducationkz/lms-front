import { Lock } from 'lucide-react';
import { useT } from '@/lib/i18n/react';
import type { AnswerResult, ClipQuestion } from '@/services/api/staffTraining';
import QuestionCard from './QuestionCard';
import '@/lib/i18n/catalogs/staffTraining';

/** The clip's questions, one card each. They open once the video is watched (90%); until then a quiet note says how far along it is. */
export default function QuestionsSection({ questions, watched, pct, locale, onAnswer, onShowMoment }: {
  questions: ClipQuestion[];
  watched: boolean;
  pct: number;
  locale: 'ru' | 'en';
  onAnswer: (question: ClipQuestion, chosen: string[]) => Promise<AnswerResult>;
  onShowMoment: (ms: number) => void;
}) {
  const t = useT();
  if (questions.length === 0) return null;
  return (
    <section aria-labelledby="st-questions" className="space-y-3">
      <h2 id="st-questions" className="text-lg font-semibold text-foreground">{t('staffTraining.questions.title')}</h2>
      {!watched ? (
        <p data-questions-locked className="flex items-start gap-2.5 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3.5 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('staffTraining.questions.locked', { pct })}
        </p>
      ) : (
        questions.map((question, i) => (
          <QuestionCard key={question.id} question={question} index={i} total={questions.length} locale={locale} onAnswer={onAnswer} onShowMoment={onShowMoment} />
        ))
      )}
    </section>
  );
}
