import { Edit, Trash2, Eye, EyeOff, UploadCloud, GraduationCap, UserCog } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { User } from '../../types';
import { roleLabel } from '@/lib/roleLabel';
import { useT } from '@/lib/i18n/react';

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
  /** Provision a student onto an external platform (SAT/NUET or IELTS). Student rows only. */
  onProvisionPlatform?: (u: User, platform: 'ielts' | 'sat') => void;
  /** ids currently being provisioned (disable the row's control + show progress). */
  provisioningIds?: Set<number>;
}

const roleBadgeClass = (role: string) =>
  role === 'admin' ? 'bg-red-100 dark:bg-red-900/30 dark:text-red-400 text-red-700'
  : role === 'teacher' ? 'bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 text-purple-700'
  : role === 'head_curator' ? 'bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 text-indigo-700'
  : role === 'curator' ? 'bg-brand-subtle text-brand-subtle-foreground'
  : 'bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700';

function GroupsCell({ user, groupNameById }: { user: User; groupNameById: Map<number, string> }) {
  const t = useT();
  const names = (user.group_ids || [])
    .map((id) => groupNameById.get(id))
    .filter((n): n is string => Boolean(n));

  if (names.length > 0) {
    return (
      <div className="flex flex-wrap gap-1 max-w-[260px]">
        {names.map((name, i) => (
          <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-brand-subtle text-brand-subtle-foreground truncate max-w-[160px]" title={name}>
            {name}
          </span>
        ))}
      </div>
    );
  }
  if (user.teacher_name || user.curator_name) {
    return (
      <div className="text-sm">
        {user.teacher_name && <div className="flex items-center gap-1 text-xs text-muted-foreground"><GraduationCap className="h-3.5 w-3.5 shrink-0" aria-label={t('users.table.teacher')} />{user.teacher_name}</div>}
        {user.curator_name && <div className="flex items-center gap-1 text-xs text-muted-foreground"><UserCog className="h-3.5 w-3.5 shrink-0" aria-label={t('users.table.curator')} />{user.curator_name}</div>}
      </div>
    );
  }
  return <span className="text-sm text-muted-foreground">{t('users.table.noGroup')}</span>;
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
  onProvisionPlatform,
  provisioningIds,
}: UsersTableProps) {
  const t = useT();
  const allChecked = selectable && users.length > 0 && users.every((u) => selectedIds?.has(Number(u.id)));
  const th = 'px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider';

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted dark:bg-secondary">
          <tr>
            {selectable && (
              <th className="px-3 @4xl:px-4 py-3 w-10">
                <Checkbox checked={allChecked} onCheckedChange={(c) => onToggleAll?.(c === true)} aria-label={t('users.table.selectAll')} />
              </th>
            )}
            <th className={th}>{t('users.table.user')}</th>
            {showRole && <th className={th}>{t('users.table.role')}</th>}
            <th className={th}>{t('users.table.groups')}</th>
            <th className={th}>{t('users.table.status')}</th>
            <th className={`${th} text-right`}>{t('users.table.actions')}</th>
          </tr>
        </thead>
        <tbody className="bg-card dark:bg-card divide-y divide-border dark:divide-border">
          {users.map((user) => {
            const id = Number(user.id);
            const checked = selectedIds?.has(id) ?? false;
            const isCuratorRow = user.role === 'curator' || user.role === 'head_curator';
            return (
              <tr key={user.id || user.email} className={`hover:bg-muted dark:hover:bg-secondary ${checked ? 'bg-brand-surface/50 dark:bg-secondary' : ''}`}>
                {selectable && (
                  <td className="px-3 @4xl:px-4 py-4">
                    <Checkbox checked={checked} onCheckedChange={(c) => onToggle?.(id, c === true)} aria-label={t('users.table.selectOne', { name: user.name || user.email })} />
                  </td>
                )}
                <td className="px-3 @4xl:px-4 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-foreground dark:text-foreground flex items-center gap-2">
                      {user.name || user.full_name}
                      {user.is_trial && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 dark:bg-amber-900/35 dark:text-amber-200 text-amber-900">
                          {t('users.table.trial')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground truncate max-w-[200px] @6xl:max-w-none" title={user.email}>{user.email}</div>
                    {user.student_id && <div className="text-xs text-muted-foreground">ID: {user.student_id}</div>}
                  </div>
                </td>
                {showRole && (
                  <td className="px-3 @4xl:px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${roleBadgeClass(user.role)}`}>{roleLabel(user.role)}</span>
                  </td>
                )}
                <td className="px-3 @4xl:px-4 py-4">
                  <GroupsCell user={user} groupNameById={groupNameById} />
                </td>
                <td className="px-3 @4xl:px-4 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span className={`px-2 py-1 text-xs rounded-full w-fit ${user.is_active ? 'bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700' : 'bg-muted text-foreground/80'}`}>
                      {user.is_active ? t('users.table.active') : t('users.table.inactive')}
                    </span>
                    {isCuratorRow && user.is_analytics_hidden && (
                      <span className="px-2 py-1 text-xs rounded-full w-fit bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 text-orange-700">
                        {t('users.table.hiddenFromAnalytics')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 @4xl:px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-0.5 @4xl:gap-2">
                    {user.role === 'student' && onProvisionPlatform && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            title={t('users.table.createPlatformAccount')}
                            disabled={provisioningIds?.has(Number(user.id))}
                          >
                            <UploadCloud className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{t('users.table.createAccount')}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => onProvisionPlatform(user, 'ielts')}>
                            IELTS
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onProvisionPlatform(user, 'sat')}>
                            SAT / NUET
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {isCuratorRow && onToggleAnalyticsHidden && (
                      <Button onClick={() => onToggleAnalyticsHidden(user)} variant="ghost" size="sm" title={user.is_analytics_hidden ? t('users.table.showInAnalytics') : t('users.table.hideFromAnalytics')}>
                        {user.is_analytics_hidden ? <Eye className="w-4 h-4 text-orange-500 dark:text-orange-400" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                      </Button>
                    )}
                    {onEdit && (
                      <Button onClick={() => onEdit(user)} variant="ghost" size="sm" title={t('users.table.editUser')}><Edit className="w-4 h-4" /></Button>
                    )}
                    {onDelete && (
                      <Button onClick={() => onDelete(user)} variant="ghost" size="sm" title={t('users.table.deactivateUser')}><Trash2 className="w-4 h-4" /></Button>
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
