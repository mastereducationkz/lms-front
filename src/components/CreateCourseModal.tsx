import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select';
import CourseCard from './CourseCard.tsx';
import apiClient from '../services/api';
import { useAuth } from '../contexts/AuthContext.tsx';
import type { CourseType } from '../types';

interface CreateCourseModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (course: any) => void;
}

export default function CreateCourseModal({ open, onClose, onCreated }: CreateCourseModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tags, setTags] = useState('');
  const [teacherId, setTeacherId] = useState<string>('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [courseType, setCourseType] = useState<CourseType>('general_english');

  const remaining = useMemo(() => Math.max(0, 64 - title.length), [title]);
  const canSubmit = title.trim().length > 0 && title.trim().length <= 64 && !saving;
  const [step, setStep] = useState<'form' | 'preview'>('form');

  useEffect(() => {
    if (!open) return;
    if (isAdmin) {
      loadTeachers();
    }
  }, [open]);

  const loadTeachers = async () => {
    try {
      const resp = await apiClient.getUsers({ role: 'teacher', limit: 100 });
      const list = Array.isArray(resp) ? resp : (resp && (resp as any).users);
      setTeachers(Array.isArray(list) ? list : []);
    } catch (e) {
      console.warn('Failed to load teachers');
    }
  };

  const resetState = () => {
    setTitle('');
    setDescription('');
    setThumbnailFile(null);
    setThumbnailPreview('');
    setTags('');
    setTeacherId('');
    setCourseType('general_english');
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSaving(true);
      const payload: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        course_type: courseType,
      };
      if (isAdmin && teacherId) payload.teacher_id = Number(teacherId);

      const created = await apiClient.createCourse(payload);

      // Thumbnail handling
      if (thumbnailFile) {
        try { await apiClient.uploadCourseThumbnail(String(created.id), thumbnailFile); } catch {}
      }

      onCreated?.(created);
      resetState();
      onClose();
    } catch (e) {
      alert('Failed to create course');
    } finally {
      setSaving(false);
    }
  };

  const applyFile = (f: File | null) => {
    if (f) {
      setThumbnailFile(f);
      const url = URL.createObjectURL(f);
      setThumbnailPreview(url);
    } else {
      setThumbnailFile(null);
      setThumbnailPreview('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetState(); setStep('form'); onClose(); } }}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{step === 'form' ? 'Create Course' : 'Preview Course Card'}</DialogTitle>
          <DialogDescription>
            {step === 'form' ? 'Fill out the details to create a new course' : 'Preview how the course card will look'}
          </DialogDescription>
        </DialogHeader>
        {step === 'form' ? (
        <div className="space-y-4">
          {/* 1) Image upload (click or drag&drop) */}
          <div>
            <Label className="mb-2 block">Thumbnail image</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => applyFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
            />
            <div
              role="button"
              aria-label="Upload course thumbnail"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const f = e.dataTransfer.files && e.dataTransfer.files[0];
                applyFile(f || null);
              }}
              className={`relative w-64 h-64 mx-auto border-2 border-dashed rounded-xl overflow-hidden flex items-center justify-center cursor-pointer transition ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'}`}
            >
              {thumbnailPreview ? (
                <img src={thumbnailPreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="text-center text-gray-500 text-sm">
                  <div className="font-medium">Click to upload</div>
                  <div className="text-xs">or drag & drop image here</div>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Тип курса</Label>
            <Select value={courseType} onValueChange={(v) => setCourseType(v as CourseType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sat">SAT</SelectItem>
                <SelectItem value="ielts">IELTS</SelectItem>
                <SelectItem value="general_english">General English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 2) Title */}
          <div>
            <Label className="mb-2 block">Title</Label>
            <Input
              value={title}
              maxLength={64}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Course title"
              className="w-full"
            />
            <div className="text-xs text-gray-500 mt-1">{remaining} characters left</div>
          </div>

          {/* 3) Description */}
          <div>
            <Label className="mb-2 block">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short course description"
              rows={3}
              className="w-full"
            />
          </div>

          {/* 4) Tags */}
          <div>
            <Label className="mb-2 block">Tags</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="react, javascript, frontend"
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Tags are for future filtering (optional)</p>
          </div>

          {isAdmin && (
            <div>
              <Label className="mb-2 block">Assign Teacher</Label>
              <Select value={teacherId} onValueChange={(v) => setTeacherId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a teacher (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(teachers) && teachers.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name} ({t.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        ) : (
          <div className="space-y-2">
            <CourseCard
              course={{
                id: 'preview',
                title: title || 'Course title',
                description: description || 'Short course description',
                image: thumbnailPreview || undefined,
                teacher: isAdmin ? ((Array.isArray(teachers) ? teachers.find(t => String(t.id) === teacherId)?.name : undefined) || 'Teacher') : (user?.name || 'Me'),
                modulesCount: 0,
                progress: 0,
                status: 'not-started',
              }}
              onContinue={() => {}}
            />
            <div className="text-xs text-gray-500">This course will be created as a draft. You can add modules and lessons next.</div>
          </div>
        )}
        <DialogFooter className="mt-4">
          {step === 'form' ? (
            <>
              <Button variant="outline" onClick={() => { resetState(); setStep('form'); onClose(); }}>Cancel</Button>
              <Button onClick={() => setStep('preview')} disabled={!canSubmit}>Next</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>Back</Button>
              <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Creating...' : 'Create & Edit'}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


