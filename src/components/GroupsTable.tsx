import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { 
  Search, 
  Download, 
  Eye, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Users,
  Clock,
  GraduationCap,
  UserCheck
} from 'lucide-react';
import { formatDate } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/teacherDesk';

interface Group {
  group_id: number;
  group_name: string;
  description: string | null;
  teacher_name: string | null;
  curator_name: string | null;
  students_count: number;
  average_completion_percentage: number;
  average_assignment_score_percentage: number;
  average_study_time_minutes: number;
  created_at: string;
}

interface GroupsTableProps {
  groups: Group[];
  isLoading?: boolean;
  onViewGroup?: (groupId: number) => void;
  onExportGroup?: (groupId: number) => void;
  onExportAll?: () => void;
}

type SortField = 'group_name' | 'students_count' | 'average_completion_percentage' | 'average_assignment_score_percentage' | 'average_study_time_minutes';
type SortDirection = 'asc' | 'desc';

export default function GroupsTable({ 
  groups, 
  isLoading = false, 
  onViewGroup, 
  onExportGroup,
  onExportAll 
}: GroupsTableProps) {
  const t = useT();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('group_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Filter groups by search query
  const filteredGroups = groups.filter(group =>
    group.group_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.teacher_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.curator_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort groups
  const sortedGroups = [...filteredGroups].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (sortField === 'group_name') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const getPerformanceBadge = (percentage: number) => {
    if (percentage >= 80) return <Badge variant="default">{t('teacherDesk.performance.excellent')}</Badge>;
    if (percentage >= 60) return <Badge variant="secondary">{t('teacherDesk.performance.good')}</Badge>;
    if (percentage >= 40) return <Badge variant="outline">{t('teacherDesk.performance.satisfactory')}</Badge>;
    return <Badge variant="destructive" className='text-center'>{t('teacherDesk.performance.needsAttention')}</Badge>;
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0
      ? t('teacherDesk.duration.hoursMinutes', { hours, minutes: mins })
      : t('teacherDesk.duration.minutesShort', { minutes: mins });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>{t('teacherDesk.groups.loading')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('teacherDesk.groups.title', { count: groups.length })}
            </CardTitle>
          </div>
          <div className="flex gap-2">
          </div>
        </div>
        
        {/* Search */}
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('teacherDesk.groups.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </CardHeader>
      
      <CardContent>
        {sortedGroups.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? t('teacherDesk.noGroupsFound') : t('teacherDesk.groups.noneAvailable')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('group_name')}
                      className="h-auto p-0 font-semibold"
                    >
                      {t('teacherDesk.col.group')} {getSortIcon('group_name')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('students_count')}
                      className="h-auto p-0 font-semibold"
                    >
                      {t('teacherDesk.groups.students')} {getSortIcon('students_count')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('average_completion_percentage')}
                      className="h-auto p-0 font-semibold"
                    >
                      {t('teacherDesk.avgProgress')} {getSortIcon('average_completion_percentage')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('average_assignment_score_percentage')}
                      className="h-auto p-0 font-semibold"
                    >
                      {t('teacherDesk.avgScore')} {getSortIcon('average_assignment_score_percentage')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('average_study_time_minutes')}
                      className="h-auto p-0 font-semibold"
                    >
                      {t('teacherDesk.groups.avgTime')} {getSortIcon('average_study_time_minutes')}
                    </Button>
                  </TableHead>
                  <TableHead>{t('teacherDesk.groups.created')}</TableHead>
                  <TableHead>{t('teacherDesk.col.status')}</TableHead>
                  <TableHead>{t('teacherDesk.col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedGroups.map((group) => (
                  <TableRow key={group.group_id}>
                    <TableCell>
                      <div>
                        {group.description && (
                          <div className="font-medium">
                            {group.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{group.students_count}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Progress value={group.average_completion_percentage} className="w-16" />
                          <span className="text-sm font-medium">{Math.round(group.average_completion_percentage)}%</span>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="text-sm font-medium">
                        {Math.round(group.average_assignment_score_percentage)}%
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{formatTime(group.average_study_time_minutes)}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-sm">{formatDate(group.created_at)}</span>
                    </TableCell>
                    
                    <TableCell>
                      {getPerformanceBadge(group.average_completion_percentage)}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex gap-1">
                        {onViewGroup && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewGroup(group.group_id)}
                            title={t('teacherDesk.groups.viewStudents')}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
