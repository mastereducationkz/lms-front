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
        className="w-full h-48 p-4 bg-background border-2 border-input rounded-lg focus:border-primary focus:outline-none resize-vertical text-foreground"
        maxLength={question.expected_length || 1000}
        disabled={disabled}
      />
      {question.expected_length && (
        <div className="text-sm text-muted-foreground text-right">
          {(value || '').length} / {question.expected_length} characters
        </div>
      )}
    </div>
  );
};
