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
  const currentLength = (value || '').length;

  return (
    <div className="space-y-4">
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your detailed answer here..."
        className="w-full h-48 p-4 bg-background border-2 border-input rounded-lg focus:border-primary focus:outline-none resize-vertical text-foreground"
        disabled={disabled}
      />
      {/* expected_length is a guideline for the student, NOT a hard cap — do not block typing */}
      {question.expected_length ? (
        <div className="text-sm text-muted-foreground text-right">
          {currentLength} characters (suggested ~{question.expected_length})
        </div>
      ) : (
        <div className="text-sm text-muted-foreground text-right">
          {currentLength} characters
        </div>
      )}
    </div>
  );
};
