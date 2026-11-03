import { useEffect, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/staffTraining';

interface Props {
  /** The text to start with (the page keeps it in the address). */
  initial?: string;
  onSubmit: (query: string) => void;
  autoFocus?: boolean;
}

/** One line to ask in either language: the box on /training and on /training/search. Empty input submits nothing. */
export default function SearchBox({ initial = '', onSubmit, autoFocus = false }: Props) {
  const t = useT();
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const query = value.trim();
    if (query) onSubmit(query);
  };

  return (
    <form role="search" onSubmit={submit} className="flex flex-col gap-2 @md:flex-row">
      <label className="sr-only" htmlFor="st-search-input">{t('staffTraining.search.label')}</label>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id="st-search-input"
          type="search"
          value={value}
          maxLength={200}
          autoFocus={autoFocus}
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('staffTraining.search.placeholder')}
          className="h-11 pl-9"
        />
      </div>
      <Button type="submit" size="lg" disabled={!value.trim()} className="shrink-0">{t('staffTraining.search.submit')}</Button>
    </form>
  );
}
