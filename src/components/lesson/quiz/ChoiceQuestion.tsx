import React from 'react';
import { CheckCircle } from 'lucide-react';
import { renderTextWithLatex } from '../../../utils/latex';

interface ChoiceQuestionProps {
  question: any;
  value: number | undefined;
  onChange: (value: number) => void;
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
  return (
    <div className="space-y-2">
      {question.options?.map((option: any, optionIndex: number) => {
        const isSelected = value === optionIndex;
        const isCorrectOption = optionIndex === question.correct_answer;
        
        let buttonClass = "w-full text-left p-3 rounded-lg border-2 transition-all duration-200";
        
        if (showResult) {
          if (isSelected) {
            if (isCorrectOption) {
              buttonClass += " bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-500";
            } else {
              buttonClass += " bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-500";
            }
          } else {
            buttonClass += " bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700";
          }
        } else {
          if (isSelected) {
            buttonClass += " bg-blue-50 border-blue-400 dark:bg-blue-900/20 dark:border-blue-400";
          } else {
            buttonClass += " bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300 dark:bg-transparent dark:hover:bg-gray-800/40 dark:border-gray-700/40 dark:hover:border-gray-600/60";
          }
        }
        
        return (
          <button
            key={option.id}
            onClick={() => onChange(optionIndex)}
            disabled={disabled}
            className={buttonClass}
          >
            <div className="flex items-start space-x-3">
              <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                showResult
                  ? isSelected
                    ? isCorrectOption
                      ? "bg-green-500 border-green-500"
                      : "bg-red-500 border-red-500"
                    : "border-gray-300 bg-white dark:border-gray-600 dark:bg-transparent"
                  : isSelected
                    ? "bg-blue-500 border-blue-500"
                    : "border-gray-300 bg-white dark:border-gray-600 dark:bg-transparent"
              }`}>
                {showResult ? (
                  isSelected ? (
                    isCorrectOption ? (
                      <CheckCircle className="w-3 h-3 text-white" />
                    ) : (
                      <div className="text-white text-xs font-bold">✗</div>
                    )
                  ) : null
                ) : (
                  isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>
              
              <span className={`text-base font-bold flex-shrink-0 ${
                showResult
                  ? isSelected
                    ? isCorrectOption ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                    : "text-gray-600 dark:text-gray-300"
                  : isSelected ? "text-blue-700 dark:text-blue-400" : "text-gray-600 dark:text-gray-300"
              }`}>
                {option.letter}.
              </span>
              
              <div className="flex-1">
                {option.text && (
                  <span className={`text-base block ${
                    showResult
                      ? isSelected
                        ? isCorrectOption ? "text-green-800 dark:text-green-400" : "text-red-800 dark:text-red-400"
                        : "text-gray-700 dark:text-gray-200"
                      : isSelected ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-200"
                  }`} dangerouslySetInnerHTML={{ __html: renderTextWithLatex(option.text) }} />
                )}
                
                {option.image_url && (
                  <img
                    src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + option.image_url}
                    alt={`Option ${option.letter}`}
                    className="mt-2 max-h-96 rounded border dark:border-gray-700"
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
