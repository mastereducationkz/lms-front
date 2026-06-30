import { useState, useEffect, useMemo } from 'react';
import { Users, Search, Loader2, Check } from 'lucide-react';
import api from '../services/api';
import { toast } from '../components/Toast';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent } from '../components/ui/dialog';
import type { Group, User } from '../types';

const sid = (u: User) => Number(u.id);
const studentLabel = (u: User) => u.name || u.full_name || u.email || `#${u.id}`;

// ── Roster management dialog (search all students, check to add/remove) ────────
function RosterDialog({ group, onClose }: { group: Group | null; onClose: (changed: boolean) => void }) {
  const open = group !== null;
  const [members, setMembers] = useState<User[]>([]);
  const [originalIds, setOriginalIds] = useState<number[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load current members when a group is opened
  useEffect(() => {
    if (!group) return;
    let cancelled = false;
    setQuery(''); setResults([]);
    setLoading(true);
    api.getGroupStudents(group.id)
      .then((list: User[]) => {
        if (cancelled) return;
        const ids = (list || []).map(sid);
        setMembers(list || []);
        setOriginalIds(ids);
        setSelected(new Set(ids));
      })
      .catch(() => { if (!cancelled) toast('Не удалось загрузить состав группы', 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [group]);

  // Debounced search across ALL students
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const handle = setTimeout(() => {
      api.getUsers({ role: 'student', all_students: true, search: q, limit: 30 })
        .then((resp: { users: User[] }) => setResults(resp.users || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const knownById = useMemo(() => {
    const m = new Map<number, User>();
    for (const u of members) m.set(sid(u), u);
    for (const u of results) m.set(sid(u), u);
    return m;
  }, [members, results]);

  // Visible rows: current members always shown; search results added when querying
  const visible = useMemo(() => {
    const ids = new Set<number>(originalIds);
    if (query.trim().length >= 2) results.forEach((r) => ids.add(sid(r)));
    const rows = [...ids].map((id) => knownById.get(id)).filter(Boolean) as User[];
    return rows.sort((a, b) => {
      const sa = selected.has(sid(a)) ? 0 : 1;
      const sb = selected.has(sid(b)) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return studentLabel(a).localeCompare(studentLabel(b), 'ru');
    });
  }, [originalIds, results, query, knownById, selected]);

  const toggle = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const toAdd = [...selected].filter((id) => !originalIds.includes(id));
  const toRemove = originalIds.filter((id) => !selected.has(id));
  const changedCount = toAdd.length + toRemove.length;

  const save = async () => {
    if (!group || changedCount === 0) { onClose(false); return; }
    setSaving(true);
    try {
      if (toAdd.length) await api.bulkAddStudentsToGroup(group.id, toAdd);
      for (const id of toRemove) await api.removeStudentFromGroup(group.id, id);
      toast(`Состав обновлён: +${toAdd.length} / −${toRemove.length}`, 'success');
      onClose(true);
    } catch (e) {
      console.error('Failed to save roster', e);
      toast('Не удалось сохранить изменения состава', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(false); }}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary shrink-0" />
            <h2 className="text-base font-semibold truncate">{group?.name}</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Выбрано {selected.size} учеников
            {changedCount > 0 && <span className="text-amber-600 dark:text-amber-400"> · {toAdd.length} добавить, {toRemove.length} удалить</span>}
          </p>
        </div>

        <div className="px-5 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Поиск ученика по имени или email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Отметьте, чтобы добавить в группу; снимите отметку у текущих — чтобы удалить.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1 min-h-[180px]">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {query.trim().length >= 2
                ? (searching ? 'Поиск…' : 'Ничего не найдено')
                : 'В группе пока нет учеников. Найдите их через поиск выше.'}
            </div>
          ) : (
            <>
              {visible.map((u) => {
                const id = sid(u);
                const isMember = originalIds.includes(id);
                return (
                  <label
                    key={id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-muted/60"
                  >
                    <Checkbox checked={selected.has(id)} onCheckedChange={(c) => toggle(id, c === true)} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{studentLabel(u)}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                    {isMember && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground shrink-0">в группе</span>
                    )}
                  </label>
                );
              })}
              {searching && query.trim().length >= 2 && (
                <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Поиск…
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onClose(false)} disabled={saving}>Отмена</Button>
          <Button size="sm" onClick={save} disabled={saving || changedCount === 0}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Сохранение</> : <><Check className="w-3.5 h-3.5 mr-1.5" /> Сохранить{changedCount > 0 ? ` (${changedCount})` : ''}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CuratorGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<Group | null>(null);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await api.getCuratorGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load groups', e);
      toast('Не удалось загрузить группы', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGroups(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;
    return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [groups, search]);

  const closeDialog = (changed: boolean) => {
    setActive(null);
    if (changed) loadGroups();
  };

  return (
    <div className="container mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-bold">Мои группы</h1>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск группы…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Users className="w-12 h-12 mb-3 opacity-50" />
              <p>{groups.length === 0 ? 'У вас пока нет групп' : 'Ничего не найдено'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActive(g)}
                  className="bg-card rounded-lg border p-4 text-left hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                    <h3 className="font-semibold truncate">{g.name}</h3>
                    {g.is_over && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border text-muted-foreground shrink-0">
                        Завершена
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-2 font-medium">
                    Управлять составом →
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <RosterDialog group={active} onClose={closeDialog} />
    </div>
  );
}
