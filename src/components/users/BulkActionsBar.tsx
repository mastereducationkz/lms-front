import React from 'react';
import { X } from 'lucide-react';

export interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

interface BulkActionsBarProps {
  count: number;
  onClear: () => void;
  actions: BulkAction[];
}

/** Floating bottom-centered toolbar shown while rows are selected. */
export function BulkActionsBar({ count, onClear, actions }: BulkActionsBarProps) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-2xl bg-slate-900 dark:bg-slate-800 px-2 py-1.5 shadow-2xl ring-1 ring-white/10">
      <div className="flex items-center gap-2 pl-2 pr-1">
        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-blue-500 text-white text-xs font-semibold tabular-nums">
          {count}
        </span>
        <span className="text-sm text-slate-300">выбрано</span>
      </div>

      <div className="h-6 w-px bg-white/15" />

      <div className="flex items-center gap-0.5">
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            disabled={a.disabled}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 h-9 text-sm font-medium transition-colors disabled:opacity-50 ${
              a.variant === 'destructive'
                ? 'text-red-300 hover:bg-red-500/15 hover:text-red-200'
                : 'text-slate-100 hover:bg-white/10'
            }`}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>

      <div className="h-6 w-px bg-white/15" />

      <button
        onClick={onClear}
        title="Снять выбор"
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
