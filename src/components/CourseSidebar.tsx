import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Check, AlertTriangle } from 'lucide-react';
import apiClient from '../services/api';

import { 
  BookOpen, 
  FileText, 
  List, 
  ChevronDown,
  LogOut,
  Image,
  Save,
} from 'lucide-react';

interface CourseSidebarProps {
  courseTitle?: string;
  courseId?: string;
  coverImageUrl?: string;
  isActive?: boolean;
  onSave?: () => void;
  hasUnsavedChanges?: boolean;
  pendingChangesCount?: number;
  onNavigate?: (section: 'overview' | 'description' | 'content') => void;
  activeSection?: 'overview' | 'description' | 'content';
  onCourseStatusChange?: (isActive: boolean) => void;
}

export default function CourseSidebar({ 
  courseTitle = "Course Title", 
  courseId, 
  coverImageUrl,
  isActive = false,
  onSave,
  hasUnsavedChanges = false,
  pendingChangesCount = 0,
  onNavigate,
  activeSection = 'content',
  onCourseStatusChange
}: CourseSidebarProps) {

  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [showUnpublishDialog, setShowUnpublishDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handlePublish = async () => {
    if (!courseId) return;
    
    setIsPublishing(true);
    try {
      await apiClient.publishCourse(courseId);
      
      setSuccessMessage('Course published successfully!');
      setShowSuccessDialog(true);
      
      // Notify parent component about status change
      onCourseStatusChange?.(true);
    } catch (error) {
      console.error('Failed to publish course:', error);
      alert('Failed to publish course. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!courseId) return;
    
    setIsUnpublishing(true);
    try {
      await apiClient.unpublishCourse(courseId);
      
      setSuccessMessage('Course unpublished successfully!');
      setShowSuccessDialog(true);
      setShowUnpublishDialog(false);
      
      // Notify parent component about status change
      onCourseStatusChange?.(false);
    } catch (error) {
      console.error('Failed to unpublish course:', error);
      alert('Failed to unpublish course. Please try again.');
    } finally {
      setIsUnpublishing(false);
    }
  };

  const courseNavItems = [
    { section: 'overview' as const, label: 'Overview', icon: BookOpen },
    { section: 'description' as const, label: 'Description', icon: FileText },
    { section: 'content' as const, label: 'Content', icon: List },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Course Header */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-3 mb-4">
          {/* Course Image */}
          <div className="flex-shrink-0">
            {coverImageUrl ? (
              <img 
                src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + coverImageUrl} 
                alt={courseTitle}
                className="w-12 h-12 rounded-lg object-cover bg-muted"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="w-12 h-12 rounded-lg bg-muted flex items-center justify-center"><svg class="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>`;
                  }
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <Image className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
          
          {/* Course Title and Status */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">{courseTitle}</h1>
            <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${
                isActive ? 'bg-green-500' : 'bg-muted-foreground/50'
              }`}></span>
              <span className={`text-xs font-medium ${
                isActive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
              }`}>
                {isActive ? 'Active' : 'Draft'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Publish/Unpublish Button - Admin Only */}
        {user?.role === 'admin' && (
          <Button 
            onClick={isActive ? () => setShowUnpublishDialog(true) : handlePublish}
            variant={isActive ? 'secondary' : 'outline'}
            className='w-full'
            disabled={isPublishing || isUnpublishing}
          >
            {isPublishing ? 'Publishing...' : isUnpublishing ? 'Unpublishing...' : isActive ? 'Unpublish' : 'Publish'}
          </Button>
        )}
      </div>

      {/* Course Navigation */}
      <nav className="p-6 flex-1">
        <div className="space-y-1 mb-6">
          {courseNavItems.map((item) => (
            <button
              key={item.section}
              onClick={() => {
                // Update URL query param while preserving current path
                const basePath = location.pathname;
                navigate(`${basePath}?tab=${item.section}`);
                onNavigate?.(item.section);
              }}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full ${
                activeSection === item.section
                  ? 'bg-brand-surface text-brand-subtle-foreground' 
                  : 'text-foreground/80 hover:bg-muted'
              }`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Save Button */}
      {onSave && (
        <div className="p-6 pt-0 mt-auto">
          <Button
            onClick={onSave}
            disabled={!hasUnsavedChanges}
            className='w-full'
            variant={hasUnsavedChanges ? 'default' : 'outline'}
          >
            {hasUnsavedChanges ? `Save` : 'No Changes'}
          </Button>
        </div>
      )}

      {/* Unpublish Confirmation Dialog */}
      <Dialog open={showUnpublishDialog} onOpenChange={setShowUnpublishDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500 dark:text-orange-400" />
              Unpublish Course
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to unpublish this course? This will change the course status from "Active" to "Draft" and students will no longer be able to access it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowUnpublishDialog(false)}
              disabled={isUnpublishing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnpublish}
              disabled={isUnpublishing}
            >
              {isUnpublishing ? 'Unpublishing...' : 'Unpublish Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500 dark:text-green-400" />
              Success
            </DialogTitle>
            <DialogDescription>
              {successMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
