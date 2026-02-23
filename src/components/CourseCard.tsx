import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { BookOpen, Clock, User, Play, CheckCircle, ArrowRight } from "lucide-react";

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
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
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
        return 'Start Learning';
      case 'completed':
        return 'Review Course';
      default:
        return 'Continue';
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
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100">
        {course.image ? (
          <img
            src={course.image}
            alt={course.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-16 w-16 text-gray-400" />
          </div>
        )}
        {/* Status Badge Overlay */}
        <div className="absolute top-3 right-3">
          <Badge 
            variant="secondary" 
            className={`${getStatusColor(course.status || 'not-started')} flex items-center gap-1`}
          >
            {getStatusIcon(course.status || 'not-started')}
            {course.status?.replace('-', ' ') || 'not started'}
          </Badge>
        </div>
      </div>

      <CardContent className="p-6">
        {/* Course Title */}
        <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {course.title}
        </h3>

        {/* Course Description */}
        {course.description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {course.description}
          </p>
        )}

        {/* Course Meta Information */}
        <div className="flex items-center text-gray-500 text-sm mb-4 space-x-3">
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            <span>{course.teacher || 'Unknown Teacher'}</span>
          </div>
          {course.modulesCount && (
            <>
              <span className="text-gray-300">•</span>
              <div className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                <span>{course.modulesCount} modules</span>
              </div>
            </>
          )}
        </div>

        {/* Progress Section */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm font-semibold text-gray-900">{course.progress}%</span>
          </div>
          <div className="relative">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  course.progress >= 100 
                    ? 'bg-gradient-to-r from-green-400 to-green-600' 
                    : course.progress > 0 
                    ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                    : 'bg-gray-300'
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