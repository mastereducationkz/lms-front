import React from 'react';
import { renderTextWithLatex } from '../../../utils/latex';

interface ChoiceQuestionProps {
  question: any;
  value: number | number[] | undefined;
  onChange: (value: number | number[]) => void;
  disabled?: boolean;
  showResult?: boolean;
}

export const ChoiceQuestion: React.FC<ChoiceQuestionProps> = ({
  question,
  value,
  onChange,
  disabled,
  showResult
}) => {
  const isMultiple = question.question_type === 'multiple_choice';

  const isSelected = (optionIndex: number) => {
    if (isMultiple) {
      return Array.isArray(value) && value.includes(optionIndex);
    }
    return value === optionIndex;
  };

  const isCorrectOption = (optionIndex: number) => {
    if (question.question_type === 'multiple_choice') {
      return Array.isArray(question.correct_answer) && question.correct_answer.includes(optionIndex);
    }
    return optionIndex === question.correct_answer;
  };

  const handleOptionClick = (optionIndex: number) => {
    if (disabled) return;
    if (isMultiple) {
      const current = Array.isArray(value)
        ? value
        : typeof value === 'number'
          ? [value]
          : [];
      const next = current.includes(optionIndex)
        ? current.filter((i) => i !== optionIndex)
        : [...current, optionIndex].sort((a, b) => a - b);
      onChange(next);
    } else {
      onChange(optionIndex);
    }
  };

  return (
    <div className="space-y-2">
      {question.options?.map((option: any, optionIndex: number) => {
        const selected = isSelected(optionIndex);
        const correct = isCorrectOption(optionIndex);

        let buttonClass = "w-full text-left p-3 rounded-lg border-2 transition-all duration-200";

        if (showResult) {
          if (selected) {
            if (correct) {
              buttonClass += " bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-500";
            } else {
              buttonClass += " bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-500";
            }
          } else if (correct && isMultiple) {
            buttonClass += " bg-emerald-50/80 border-emerald-300 dark:bg-emerald-900/15 dark:border-emerald-700";
          } else {
            buttonClass += " bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700";
          }
        } else {
          if (selected) {
            buttonClass += " bg-blue-50 border-blue-400 dark:bg-blue-900/20 dark:border-blue-400";
          } else {
            buttonClass += " bg-card hover:bg-accent border-border hover:border-border/80";
          }
        }

        return (
          <button
            key={option.id ?? optionIndex}
            type="button"
            onClick={() => handleOptionClick(optionIndex)}
            disabled={disabled}
            className={buttonClass}
          >
            <div className="flex items-start space-x-3">
              <span
                className={`text-base font-bold flex-shrink-0 ${
                  showResult
                    ? selected
                      ? correct
                        ? "text-green-700 dark:text-green-400"
                        : "text-red-700 dark:text-red-400"
                      : correct && isMultiple
                        ? "text-emerald-800 dark:text-emerald-300"
                        : "text-gray-600 dark:text-gray-300"
                    : selected
                      ? "text-blue-700 dark:text-blue-400"
                      : "text-muted-foreground"
                }`}
              >
                {option.letter}.
              </span>

              <div className="flex-1">
                {option.text && (
                  <span
                    className={`text-base block ${
                      showResult
                        ? selected
                          ? correct
                            ? "text-green-800 dark:text-green-400"
                            : "text-red-800 dark:text-red-400"
                          : correct && isMultiple
                            ? "text-emerald-900 dark:text-emerald-200"
                            : "text-gray-700 dark:text-gray-200"
                        : selected
                          ? "text-foreground"
                          : "text-foreground/90"
                    }`}
                    dangerouslySetInnerHTML={{ __html: renderTextWithLatex(option.text) }}
                  />
                )}

                {option.image_url && (
                  <img
                    src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + option.image_url}
                    alt={`Option ${option.letter}`}
                    className="mt-2 max-h-96 rounded border border-border"
                  />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
