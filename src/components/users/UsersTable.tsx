import { Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import type { User } from '../../types';

interface UsersTableProps {
  users: User[];
  /** Unfiltered group id → name map (so inactive-group names still resolve). */
  groupNameById: Map<number, string>;
  showRole?: boolean;
  selectable?: boolean;
  selectedIds?: Set<number>;
  onToggle?: (id: number, checked: boolean) => void;
  onToggleAll?: (checked: boolean) => void;
  onEdit?: (u: User) => void;
  onDelete?: (u: User) => void;
  onToggleAnalyticsHidden?: (u: User) => void;
}

const roleBadgeClass = (role: string) =>
  role === 'admin' ? 'bg-red-100 dark:bg-red-900/30 dark:text-red-400 text-red-700'
  : role === 'teacher' ? 'bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 text-purple-700'
  : role === 'head_curator' ? 'bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 text-indigo-700'
  : role === 'curator' ? 'bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 text-blue-700'
  : 'bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700';

function GroupsCell({ user, groupNameById }: { user: User; groupNameById: Map<number, string> }) {
  const names = (user.group_ids || [])
    .map((id) => groupNameById.get(id))
    .filter((n): n is string => Boolean(n));

  if (names.length > 0) {
    return (
      <div className="flex flex-wrap gap-1 max-w-[260px]">
        {names.map((name, i) => (
          <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 truncate max-w-[160px]" title={name}>
            {name}
          </span>
        ))}
      </div>
    );
  }
  if (user.teacher_name || user.curator_name) {
    return (
      <div className="text-sm">
        {user.teacher_name && <div className="text-xs text-gray-500 dark:text-gray-400">👨‍🏫 {user.teacher_name}</div>}
        {user.curator_name && <div className="text-xs text-gray-500 dark:text-gray-400">👨‍💼 {user.curator_name}</div>}
      </div>
    );
  }
  return <span className="text-sm text-gray-500 dark:text-gray-400">No group</span>;
}

export function UsersTable({
  users,
  groupNameById,
  showRole = true,
  selectable = false,
  selectedIds,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
  onToggleAnalyticsHidden,
}: UsersTableProps) {
  const allChecked = selectable && users.length > 0 && users.every((u) => selectedIds?.has(Number(u.id)));
  const th = 'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider';

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-secondary">
          <tr>
            {selectable && (
              <th className="px-4 py-3 w-10">
                <Checkbox checked={allChecked} onCheckedChange={(c) => onToggleAll?.(c === true)} aria-label="Выбрать всех на странице" />
              </th>
            )}
            <th className={th}>User</th>
            {showRole && <th className={th}>Role</th>}
            <th className={th}>Groups</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
          {users.map((user) => {
            const id = Number(user.id);
            const checked = selectedIds?.has(id) ?? false;
            const isCuratorRow = user.role === 'curator' || user.role === 'head_curator';
            return (
              <tr key={user.id || user.email} className={`hover:bg-gray-50 dark:hover:bg-secondary ${checked ? 'bg-blue-50/50 dark:bg-secondary' : ''}`}>
                {selectable && (
                  <td className="px-4 py-4">
                    <Checkbox checked={checked} onCheckedChange={(c) => onToggle?.(id, c === true)} aria-label={`Выбрать ${user.name || user.email}`} />
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-foreground flex items-center gap-2">
                      {user.name || user.full_name}
                      {user.is_trial && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/35 dark:text-amber-200 text-amber-900">
                          Trial
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                    {user.student_id && <div className="text-xs text-gray-400">ID: {user.student_id}</div>}
                  </div>
                </td>
                {showRole && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${roleBadgeClass(user.role)}`}>{user.role}</span>
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap">
                  <GroupsCell user={user} groupNameById={groupNameById} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span className={`px-2 py-1 text-xs rounded-full w-fit ${user.is_active ? 'bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-400 text-gray-700'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {isCuratorRow && user.is_analytics_hidden && (
                      <span className="px-2 py-1 text-xs rounded-full w-fit bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 text-orange-700">
                        Скрыт из аналитики
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    {isCuratorRow && onToggleAnalyticsHidden && (
                      <Button onClick={() => onToggleAnalyticsHidden(user)} variant="ghost" size="sm" title={user.is_analytics_hidden ? 'Показать в аналитике' : 'Скрыть из аналитики'}>
                        {user.is_analytics_hidden ? <Eye className="w-4 h-4 text-orange-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                      </Button>
                    )}
                    {onEdit && (
                      <Button onClick={() => onEdit(user)} variant="ghost" size="sm" title="Edit User"><Edit className="w-4 h-4" /></Button>
                    )}
                    {onDelete && (
                      <Button onClick={() => onDelete(user)} variant="ghost" size="sm" title="Deactivate User"><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
