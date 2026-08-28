import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import apiClient from '../services/api';

/**
 * Global student search for staff dashboards (admin, head curator, head teacher,
 * curator). Debounced typeahead over /student-journal/list — the server scopes
 * rows to the caller (a curator only sees their own groups' students), so one
 * component serves every role. Picking a student opens their results report.
 */

interface JournalStudent {
  id: number;
  name: string;
  email: string;
  group_name: string | null;
}

export default function StudentSearchBox({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JournalStudent[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await apiClient.getStudentsJournal({ search: q, limit: 8 });
        if (seq !== requestSeq.current) return; // a newer query superseded this one
        setResults(data.students ?? []);
        setHighlight(0);
        setOpen(true);
      } catch (e) {
        console.error('Student search failed:', e);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const openStudent = (s: JournalStudent) => {
    setOpen(false);
    setQuery('');
    navigate(`/curator/students/${s.id}/report`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openStudent(results[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Найти студента: имя или email…"
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-gray-400"
        />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-gray-400">
              {loading ? 'Ищем…' : 'Студенты не найдены'}
            </p>
          ) : (
            results.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => openStudent(s)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 ${
                  i === highlight ? 'bg-blue-50' : 'bg-white'
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm text-gray-900 truncate">{s.name}</span>
                  <span className="block text-xs text-gray-400 truncate">{s.email}</span>
                </span>
                {s.group_name && (
                  <span className="shrink-0 text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
                    {s.group_name}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
