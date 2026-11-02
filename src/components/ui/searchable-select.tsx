import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/sharedUi';
import { DropdownRoot, DropdownTrigger, DropdownValue, TRIGGER_BASE, normalizeDisplay } from './dropdown/Dropdown';
import { DropdownPanel } from './dropdown/DropdownPanel';
import type { DropdownEntry } from './dropdown/logic';

export interface SearchableOption {
  value: string;
  label: string;
  /** Secondary text on the right of the row; also searched. */
  hint?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Id of the trigger button, so a <label htmlFor> can name it. */
  id?: string;
}

/**
 * A single-choice dropdown over a plain option list, on the app's one dropdown engine: from 6
 * options a search box filters it (every typed word must match the label or hint), Enter picks.
 */
export function SearchableSelect({
  options, value, onChange, placeholder, searchPlaceholder, emptyText, disabled, className, ariaLabel, id,
}: SearchableSelectProps) {
  const t = useT();
  const entries = useMemo<DropdownEntry[]>(() => options.map((o, i) => ({
    kind: 'option', key: `${i}:${o.value}`, value: o.value, label: o.label, text: o.label, keywords: o.hint, hint: o.hint,
  })), [options]);

  return (
    <DropdownRoot
      entries={entries}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
    >
      <DropdownTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(TRIGGER_BASE, 'bg-background font-normal', normalizeDisplay(className))}
      >
        <DropdownValue placeholder={placeholder ?? t('sharedUi.select.placeholder')} />
      </DropdownTrigger>
      {/* As wide as it always was: long group names and hints fit on one line. */}
      <DropdownPanel className="min-w-[min(18rem,calc(100vw-1rem))]" />
    </DropdownRoot>
  );
}
