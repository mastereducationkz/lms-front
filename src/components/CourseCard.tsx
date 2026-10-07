import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { BookOpen, Clock, User, Play, CheckCircle, ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n/react";
import "@/lib/i18n/catalogs/courseAuthoring";

interface CourseCardData {
  id: string;
  title: string;
  description?: string;
  image?: string;
  teacher?: string;
  modulesCount?: number;
  progress: number;
  status?: 'not-started' | 'in-progress' | 'completed' | string;
}

interface CourseCardProps {
  course: CourseCardData;
  onContinue: (courseId: string) => void;
}

export default function CourseCard({ course, onContinue }: CourseCardProps) {
  const t = useT();
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-200 dark:hover:bg-green-900/60';
      case 'in-progress':
        return 'bg-brand-subtle text-brand-subtle-foreground hover:bg-blue-200 dark:hover:bg-brand-subtle/80';
      default:
        return 'bg-muted text-gray-700 dark:text-foreground hover:bg-gray-200 dark:hover:bg-foreground/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'in-progress':
        return <Clock className="h-4 w-4" />;
      default:
        return <Play className="h-4 w-4" />;
    }
  };

  const getButtonText = (status: string) => {
    switch (status) {
      case 'not-started':
        return t('courseAuthoring.courseCard.start');
      case 'completed':
        return t('courseAuthoring.courseCard.review');
      default:
        return t('courseAuthoring.courseCard.continue');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'not-started':
        return t('courseAuthoring.courseCard.notStarted');
      case 'in-progress':
        return t('courseAuthoring.courseCard.inProgress');
      case 'completed':
        return t('courseAuthoring.courseCard.completed');
      default:
        return status.replace('-', ' ');
    }
  };

  const getButtonVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'outline';
      default:
        return 'default';
    }
  };

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-0 shadow-sm">
      {/* Course Image */}
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-brand-surface dark:to-brand-subtle">
        {course.image ? (
          <img
            src={course.image}
            alt={course.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-16 w-16 text-gray-400 dark:text-muted-foreground" />
          </div>
        )}
        {/* Status Badge Overlay */}
        <div className="absolute top-3 right-3">
          <Badge 
            variant="secondary" 
            className={`${getStatusColor(course.status || 'not-started')} flex items-center gap-1`}
          >
            {getStatusIcon(course.status || 'not-started')}
            {getStatusLabel(course.status || 'not-started')}
          </Badge>
        </div>
      </div>

      <CardContent className="p-6">
        {/* Course Title */}
        <h3 className="text-xl font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-brand transition-colors">
          {course.title}
        </h3>

        {/* Course Description */}
        {course.description && (
          <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
            {course.description}
          </p>
        )}

        {/* Course Meta Information */}
        <div className="flex items-center text-muted-foreground text-sm mb-4 space-x-3">
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            <span>{course.teacher || t('courseAuthoring.courseCard.unknownTeacher')}</span>
          </div>
          {course.modulesCount && (
            <>
              <span className="text-gray-300 dark:text-muted-foreground">•</span>
              <div className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                <span>{t('courseAuthoring.courseCard.modules', { count: course.modulesCount })}</span>
              </div>
            </>
          )}
        </div>

        {/* Progress Section */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-foreground">{t('courseAuthoring.courseCard.progress')}</span>
            <span className="text-sm font-semibold text-foreground">{course.progress}%</span>
          </div>
          <div className="relative">
            <div className="w-full bg-gray-200 dark:bg-secondary rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  course.progress >= 100 
                    ? 'bg-gradient-to-r from-green-400 to-green-600' 
                    : course.progress > 0 
                    ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                    : 'bg-gray-300 dark:bg-secondary'
                }`}
                style={{ width: `${course.progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => onContinue(course.id)}
          variant={getButtonVariant(course.status || 'not-started')}
          className="w-full group/btn transition-all duration-200"
          size="sm"
        >
          {getButtonText(course.status || 'not-started')}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
        </Button>
      </CardContent>
    </Card>
  );
} 