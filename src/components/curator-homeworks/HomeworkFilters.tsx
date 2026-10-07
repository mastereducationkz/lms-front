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
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/curatorHomeworks';
import '@/lib/i18n/catalogs/attendance';

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
  const t = useT();
  return (
    <div className="flex flex-wrap gap-4 items-center bg-card p-4 rounded-lg border">
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('curatorHomeworks.filter.searchStudents')}
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
          <SelectValue placeholder={t('curatorHomeworks.filter.status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('common.all')}</SelectItem>
          <SelectItem value="submitted">{t('attendance.hwStatus.inReview')}</SelectItem>
          <SelectItem value="graded">{t('curatorHomeworks.filter.graded')}</SelectItem>
          <SelectItem value="not_submitted">{t('attendance.hwStatus.notSubmitted')}</SelectItem>
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
          {t('curatorHomeworks.filter.showFinished')}
        </Label>
      </div>
    </div>
  );
};
