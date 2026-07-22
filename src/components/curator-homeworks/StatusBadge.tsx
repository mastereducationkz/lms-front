import { Badge } from '../ui/badge';
import { CheckCircle, Clock, AlertCircle, MinusCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  score: number | null;
  maxScore: number;
  // Submitted after the (possibly extended) deadline. When true, the graded/submitted
  // badge keeps its normal styling but gains a small "Поздно" label underneath.
  late?: boolean;
}

// Wraps a badge with an optional "Поздно" label below it (late but submitted).
const WithLate: React.FC<{ late?: boolean; children: React.ReactNode }> = ({ late, children }) =>
  late ? (
    <span className="inline-flex flex-col items-end gap-0.5">
      {children}
      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Поздно</span>
    </span>
  ) : (
    <>{children}</>
  );

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, score, maxScore, late }) => {
  if (status === 'graded' && score !== null) {
    return (
      <WithLate late={late}>
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          {score}/{maxScore}
        </Badge>
      </WithLate>
    );
  }

  if (status === 'submitted') {
    return (
      <WithLate late={late}>
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <Clock className="w-3 h-3 mr-1" />
          На проверке
        </Badge>
      </WithLate>
    );
  }

  if (status === 'overdue') {
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        <AlertCircle className="w-3 h-3 mr-1" />
        Просрочено
      </Badge>
    );
  }
  
  return (
    <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
      <MinusCircle className="w-3 h-3 mr-1" />
      Не сдано
    </Badge>
  );
};
