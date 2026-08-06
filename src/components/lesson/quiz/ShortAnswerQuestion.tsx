import React from 'react';

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
  const expectedAnswers = (question.correct_answer || '').toString().split('|').map((a: string) => a.trim()).filter((a: string) => a.length > 0);
  const correctAnswers = expectedAnswers.map((a: string) => a.toLowerCase());
  const userVal = (value || '').toString().trim().toLowerCase();
  const isCorrect = correctAnswers.includes(userVal);

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your answer..."
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
          <span className="font-medium text-foreground">Correct answer: </span>
          <span className="text-green-700 dark:text-green-400">{expectedAnswers.join(' or ')}</span>
        </p>
      )}
    </div>
  );
};
