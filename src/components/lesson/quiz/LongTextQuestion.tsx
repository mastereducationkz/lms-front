import React from 'react';

interface LongTextQuestionProps {
  question: any;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const LongTextQuestion: React.FC<LongTextQuestionProps> = ({
  question,
  value,
  onChange,
  disabled
}) => {
  return (
    <div className="space-y-4">
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your detailed answer here..."
        className="w-full h-32 p-4 bg-white border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-vertical dark:bg-card dark:border-gray-600 dark:text-white dark:focus:border-blue-400"
        maxLength={question.expected_length || 1000}
        disabled={disabled}
      />
      {question.expected_length && (
        <div className="text-sm text-gray-500 text-right dark:text-gray-400">
          {(value || '').length} / {question.expected_length} characters
        </div>
      )}
    </div>
  );
};
