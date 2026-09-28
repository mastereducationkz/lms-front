import React from 'react';
import { Check } from 'lucide-react';

interface StepperProps {
  steps: string[];
  current: number; // 0-based index
  onStepChange?: (index: number) => void;
  className?: string;
}

export default function Stepper({ steps, current, onStepChange, className = '' }: StepperProps) {
  return (
    <div className={`w-full`}>      
      <ol className={`flex items-center w-full text-sm ${className}`}>
        {steps.map((label, index) => {
          const isActive = index === current;
          const isCompleted = index < current;
          return (
            <li key={label} className="flex-1 flex items-center">
              <button
                type="button"
                onClick={() => onStepChange && onStepChange(index)}
                className={`group flex items-center gap-3 w-full text-left`}>
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-full border transition 
                  ${isCompleted ? 'bg-blue-600 text-white border-blue-600' : isActive ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-gray-300 text-gray-500 dark:border-border dark:text-gray-400'}
                `}
                >
                  {isCompleted ? <Check className="h-4 w-4" aria-label="Completed" /> : index + 1}
                </span>
                <span className={`${isActive ? 'text-gray-900 dark:text-foreground' : 'text-gray-500 dark:text-gray-400'} font-medium`}>{label}</span>
              </button>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-px mx-4 ${index < current ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}


