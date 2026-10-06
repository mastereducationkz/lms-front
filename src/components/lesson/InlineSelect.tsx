import React from 'react';

interface InlineSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  options: string[];
  disabled?: boolean;
  className?: string;
}

export const InlineSelect: React.FC<InlineSelectProps> = ({
  value,
  onValueChange,
  placeholder = 'Select',
  options,
  disabled = false,
  className = '',
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
      className={`px-2 py-1 border-2 border-blue-400 dark:border-brand/60 rounded bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((opt, index) => (
        <option key={index} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
};
