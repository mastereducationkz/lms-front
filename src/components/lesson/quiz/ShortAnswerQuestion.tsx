import React from 'react';
import { useT } from '../../../lib/i18n/react';
import '@/lib/i18n/catalogs/lessonPlayer';
import { matchesAnyAnswer, splitAlternatives } from './answerMatch';

interface ShortAnswerQuestionProps {
  question: any;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showResult?: boolean;
  revealCorrect?: boolean;
}

export const ShortAnswerQuestion: React.FC<ShortAnswerQuestionProps> = ({
  question,
  value,
  onChange,
  disabled,
  showResult,
  revealCorrect
}) => {
  const t = useT();
  const expectedAnswers = splitAlternatives(question.correct_answer);
  // The same matcher the score uses, so a border never disagrees with the points (13,5 is 13.5).
  const isCorrect = matchesAnyAnswer(question.correct_answer, value);

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('lessonPlayer.shortAnswer.placeholder')}
        className={`w-full p-4 border-2 rounded-lg focus:outline-none ${
          showResult
            ? isCorrect
              ? 'border-green-500 bg-green-50 dark:border-green-500 dark:bg-green-900/20'
              : 'border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-900/20'
            : 'border-input focus:border-primary bg-background text-foreground'
        }`}
        disabled={disabled}
      />
      {revealCorrect && !isCorrect && expectedAnswers.length > 0 && (
        <p className="text-sm">
          <span className="font-medium text-foreground">{t('lessonPlayer.shortAnswer.correctLabel')} </span>
          <span className="text-green-700 dark:text-green-400">{expectedAnswers.join(` ${t('lessonPlayer.shortAnswer.or')} `)}</span>
        </p>
      )}
    </div>
  );
};
