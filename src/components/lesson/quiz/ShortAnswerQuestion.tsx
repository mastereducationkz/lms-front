import React from 'react';

interface ShortAnswerQuestionProps {
  question: any;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  showResult?: boolean;
}

export const ShortAnswerQuestion: React.FC<ShortAnswerQuestionProps> = ({
  question,
  value,
  onChange,
  disabled,
  showResult
}) => {
  const correctAnswers = (question.correct_answer || '').toString().split('|').map((a: string) => a.trim().toLowerCase()).filter((a: string) => a.length > 0);
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
            : 'border-gray-300 focus:border-blue-500 dark:border-gray-600 dark:focus:border-blue-500 dark:bg-card dark:text-white'
        }`}
        disabled={disabled}
      />
      {/* Result Indicator - Logic removed as requested to avoid confusion and redundancy */}
    </div>
  );
};
