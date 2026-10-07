import { Search, Users, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';

export interface PickerUser {
  id: number;
  name: string;
  email: string;
}

/** The admin progress tool's student search (moved out of AdminProgressTool to keep files small). */
export default function AdminStudentPicker({
  selectedUser,
  filteredUsers,
  userSearch,
  setUserSearch,
  isUserDropdownOpen,
  setIsUserDropdownOpen,
  selectUserFromDropdown,
  clearUserSelection,
}: {
  selectedUser: PickerUser | null;
  filteredUsers: PickerUser[];
  userSearch: string;
  setUserSearch: (value: string) => void;
  isUserDropdownOpen: boolean;
  setIsUserDropdownOpen: (open: boolean) => void;
  selectUserFromDropdown: (userId: number) => void;
  clearUserSelection: () => void;
}) {
  const t = useT();
  return (
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          {t('settings.progress.student')}
        </Label>
      
        <div className="relative user-search-dropdown">
          {selectedUser ? (
            <div className="flex items-center justify-between px-3 py-2 border rounded-md bg-brand-surface border-brand-border">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{selectedUser.name}</p>
                <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearUserSelection}
                className="ml-2 h-8 w-8 p-0 hover:bg-brand-subtle"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-muted-foreground" />
                <Input
                  placeholder={t('settings.progress.searchPlaceholder')}
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setIsUserDropdownOpen(true);
                  }}
                  onFocus={() => setIsUserDropdownOpen(true)}
                  className="pl-9"
                />
              </div>
            
              {isUserDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-card border dark:border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <div className="px-3 py-4 text-center text-muted-foreground text-sm">
                      {userSearch ? t('settings.progress.noStudents') : t('settings.progress.typeToSearch')}
                    </div>
                  ) : (
                    filteredUsers.slice(0, 50).map(u => (
                      <div
                        key={u.id}
                        onClick={() => selectUserFromDropdown(u.id)}
                        className="px-3 py-2 cursor-pointer hover:bg-muted border-b dark:border-border last:border-b-0"
                      >
                        <p className="font-medium text-sm">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    ))
                  )}
                  {filteredUsers.length > 50 && (
                    <div className="px-3 py-2 text-center text-gray-400 dark:text-muted-foreground text-xs">
                      {t('settings.progress.shownOf', { shown: 50, total: filteredUsers.length })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
  );
}
