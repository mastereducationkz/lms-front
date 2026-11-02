import { Check } from 'lucide-react';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/courseAuthoring';

interface StepperProps {
  steps: string[];
  current: number; // 0-based index
  onStepChange?: (index: number) => void;
  className?: string;
}

// Five labelled steps need ~56rem. Narrower (phones, tablets, or a desktop with the app sidebar
// open) the row shows only the numbered circles and the current step's name goes on a line below.
export default function Stepper({ steps, current, onStepChange, className = '' }: StepperProps) {
  const t = useT();
  return (
    <div className="w-full @container">
      <ol className={`flex items-center w-full text-sm ${className}`}>
        {steps.map((label, index) => {
          const isActive = index === current;
          const isCompleted = index < current;
          const isLast = index === steps.length - 1;
          return (
            <li key={label} className={`flex items-center min-w-0 ${isLast ? 'flex-none' : 'flex-1'}`}>
              <button
                type="button"
                onClick={() => onStepChange && onStepChange(index)}
                aria-current={isActive ? 'step' : undefined}
                className="group flex flex-shrink-0 items-center gap-3 text-left">
                <span
                  className={`flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-full border transition
                  ${isCompleted ? 'bg-blue-600 text-white border-blue-600' : isActive ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-gray-300 text-gray-500 dark:border-border dark:text-gray-400'}
                `}
                >
                  {isCompleted ? <Check className="h-4 w-4" aria-label={t('courseAuthoring.stepper.completed')} /> : index + 1}
                </span>
                <span className={`sr-only @4xl:not-sr-only ${isActive ? 'text-gray-900 dark:text-foreground' : 'text-gray-500 dark:text-gray-400'} font-medium`}>{label}</span>
              </button>
              {!isLast && (
                <div className={`flex-1 min-w-2 h-px mx-2 @4xl:mx-4 ${index < current ? 'bg-blue-600' : 'bg-gray-200 dark:bg-border'}`} />
              )}
            </li>
          );
        })}
      </ol>
      {steps[current] && (
        <p className="@4xl:hidden mt-3 text-sm font-medium text-foreground" aria-hidden="true">
          {t('courseAuthoring.stepper.stepOf', { n: current + 1, total: steps.length, label: steps[current] })}
        </p>
      )}
    </div>
  );
}
