import React from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { StatusFilter } from './types';

interface HomeworkFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  showCompletedGroups: boolean;
  onShowCompletedGroupsChange: (value: boolean) => void;
}

export const HomeworkFilters: React.FC<HomeworkFiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  showCompletedGroups,
  onShowCompletedGroupsChange,
}) => {
  return (
    <div className="flex flex-wrap gap-4 items-center bg-card p-4 rounded-lg border">
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени студента..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <Select
        value={statusFilter}
        onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}
      >
        <SelectTrigger className="w-[180px]">
          <Filter className="w-4 h-4 mr-2" />
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все</SelectItem>
          <SelectItem value="submitted">На проверке</SelectItem>
          <SelectItem value="graded">Оценено</SelectItem>
          <SelectItem value="not_submitted">Не сдано</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Checkbox
          id="show-completed-groups"
          checked={showCompletedGroups}
          onCheckedChange={(checked) => onShowCompletedGroupsChange(Boolean(checked))}
        />
        <Label
          htmlFor="show-completed-groups"
          className="text-sm text-muted-foreground cursor-pointer select-none"
        >
          Показывать завершенные группы
        </Label>
      </div>
    </div>
  );
};
