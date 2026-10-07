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
  BookOpen,
  BarChart3
} from 'lucide-react';
import { formatDate } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/teacherDesk';

interface Student {
  student_id: number;
  student_name: string;
  student_email: string;
  student_number: string;
  groups: Array<{ id: number; name: string }>;
  active_courses_count: number;
  total_steps: number;
  completed_steps: number;
  completion_percentage: number;
  total_assignments: number;
  completed_assignments: number;
  assignment_score_percentage: number;
  total_study_time_minutes: number;
  daily_streak: number;
  last_activity_date: string | null;
  last_lesson: {
    lesson_title: string;
    lesson_progress_percentage: number;
    completed_steps: number;
    total_steps: number;
  } | null;
}

interface StudentsTableProps {
  students: Student[];
  isLoading?: boolean;
  onViewStudent?: (studentId: number) => void;
  onViewDetailedProgress?: (studentId: number) => void;
  onExportStudent?: (studentId: number) => void;
  onExportAll?: () => void;
}

type SortField = 'student_name' | 'completion_percentage' | 'total_study_time_minutes' | 'daily_streak' | 'assignment_score_percentage';
type SortDirection = 'asc' | 'desc';

export default function StudentsTable({ 
  students, 
  isLoading = false, 
  onViewStudent, 
  onViewDetailedProgress,
  onExportStudent,
  onExportAll 
}: StudentsTableProps) {
  const t = useT();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('student_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Normalize student data to ensure groups is always an array
  const normalizedStudents = students.map(student => ({
    ...student,
    groups: student.groups || []
  }));

  // Filter students by search query
  const filteredStudents = normalizedStudents.filter(student =>
    student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.groups && student.groups.some(group => group.name.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  // Sort students
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];

    if (sortField === 'student_name') {
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

  const getStatusBadge = (percentage: number) => {
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

  const formatLastActivity = (dateString: string | null) => {
    if (!dateString) return t('teacherDesk.never');
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return t('teacherDesk.students.today');
    if (diffDays === 1) return t('teacherDesk.students.yesterday');
    if (diffDays < 7) return t('teacherDesk.students.daysAgo', { count: diffDays });
    return formatDate(date);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>{t('teacherDesk.students.loading')}</p>
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
              {t('teacherDesk.students.title', { count: students.length })}
            </CardTitle>
          </div>
          <div className="flex gap-2">
          </div>
        </div>
        
        {/* Search */}
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('teacherDesk.students.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </CardHeader>
      
      <CardContent>
        {sortedStudents.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? t('teacherDesk.students.noneFound') : t('teacherDesk.students.noneAvailable')}
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
                      onClick={() => handleSort('student_name')}
                      className="h-auto p-0 font-semibold"
                    >
                      {t('teacherDesk.students.student')} {getSortIcon('student_name')}
                    </Button>
                  </TableHead>
                  <TableHead>{t('teacherDesk.students.groups')}</TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('completion_percentage')}
                      className="h-auto p-0 font-semibold"
                    >
                      {t('teacherDesk.col.progress')} {getSortIcon('completion_percentage')}
                    </Button>
                  </TableHead>
                  <TableHead>{t('teacherDesk.students.currentLesson')}</TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('assignment_score_percentage')}
                      className="h-auto p-0 font-semibold"
                    >
                      {t('teacherDesk.students.assignments')} {getSortIcon('assignment_score_percentage')}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort('total_study_time_minutes')}
                      className="h-auto p-0 font-semibold"
                    >
                      {t('teacherDesk.col.time')} {getSortIcon('total_study_time_minutes')}
                    </Button>
                  </TableHead>
                  <TableHead>{t('teacherDesk.col.lastActivity')}</TableHead>
                  <TableHead>{t('teacherDesk.col.status')}</TableHead>
                  <TableHead>{t('teacherDesk.col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStudents.map((student) => (
                  <TableRow key={student.student_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{student.student_name}</div>
                        <div className="text-sm text-muted-foreground">{student.student_email}</div>
                        {student.student_number && (
                          <div className="text-xs text-muted-foreground">ID: {student.student_number}</div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {student.groups.length > 0 ? (
                          student.groups.map((group) => (
                            <Badge key={group.id} variant="outline" className="text-xs text-center whitespace-nowrap">
                              {group.name.split('-')[1]}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('teacherDesk.students.noGroup')}</span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Progress value={student.completion_percentage} className="w-16" />
                          <span className="text-sm font-medium">{Math.round(student.completion_percentage)}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t('teacherDesk.students.steps', { done: student.completed_steps, total: student.total_steps })}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        {student.last_lesson ? (
                          <>
                            <div className="text-sm font-medium truncate max-w-32" title={student.last_lesson.lesson_title}>
                              {student.last_lesson.lesson_title}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Progress value={student.last_lesson.lesson_progress_percentage} className="w-12" />
                              <span className="text-xs text-muted-foreground">
                                {Math.round(student.last_lesson.lesson_progress_percentage)}%
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t('teacherDesk.students.steps', { done: student.last_lesson.completed_steps, total: student.last_lesson.total_steps })}
                            </div>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('teacherDesk.students.noActivity')}</span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          {student.completed_assignments}/{student.total_assignments}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t('teacherDesk.students.avgScore', { percent: Math.round(student.assignment_score_percentage) })}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{formatTime(student.total_study_time_minutes)}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-sm">{formatLastActivity(student.last_activity_date)}</span>
                    </TableCell>
                    
                    <TableCell>
                      {getStatusBadge(student.completion_percentage)}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex gap-1">
                      
                        {onViewDetailedProgress && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewDetailedProgress(student.student_id)}
                            title={t('teacherDesk.students.detailedProgress')}
                          >
                            <BarChart3 className="w-4 h-4" />
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
