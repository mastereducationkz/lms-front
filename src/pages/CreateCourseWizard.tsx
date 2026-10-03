import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stepper from '../components/Stepper.tsx';
import Button from '../components/Button.tsx';
import apiClient from '../services/api';

export default function CreateCourseWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string>('');
  const [thumbnail, setThumbnail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>('');

  const steps = ['Details', 'Curriculum', 'Content & Media', 'Assessments', 'Publish'];

  const canContinue = () => {
    if (step === 0) return title.trim().length > 2;
    return true;
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      const created = await apiClient.createCourse({ title: title.trim(), description: description.trim(), cover_image_url: thumbnail.trim() || undefined, tags: tags.split(',').map(t => t.trim()).filter(Boolean) });
      // If a file was selected, upload it as thumbnail (overrides URL)
      if (file) {
        try {
          await apiClient.uploadCourseThumbnail(String(created.id), file);
        } catch (e) {
          console.warn('Thumbnail upload failed, keeping URL if provided');
        }
      } else if (thumbnail.trim()) {
        try {
          await apiClient.setCourseThumbnailUrl(String(created.id), thumbnail.trim());
        } catch (e) {
          console.warn('Setting thumbnail URL failed');
        }
      }
      navigate(`/teacher/course/${created.id}/builder`);
    } catch (e) {
      alert('Failed to create course');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Create Course</h1>
      <div className="card p-6">
        <Stepper steps={steps} current={step} onStepChange={setStep} />

        <div className="mt-6">
          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Course Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" placeholder="e.g. React for Beginners" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail URL</label>
                <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="https://.../image.jpg" />
                {thumbnail && (
                  <div className="mt-3">
                    <img src={thumbnail} alt="Preview" className="w-full h-40 object-cover rounded-lg border" onError={() => { /* silent */ }} />
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" rows={4} placeholder="What will students learn?" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. react, javascript, frontend" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="text-gray-600">
              <p className="mb-2 font-medium">Curriculum</p>
              <p className="text-sm">You can add modules and lessons later in the builder. This step will be enhanced soon.</p>
            </div>
          )}

          {step === 2 && (
            <div className="text-gray-600">
              <p className="mb-2 font-medium">Content & Media</p>
              <p className="text-sm">Attach text and video per lesson in the builder. You can set a course thumbnail here:</p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Thumbnail URL</label>
                  <input value={thumbnail} onChange={(e) => { setThumbnail(e.target.value); setFile(null); setFilePreview(''); }} className="w-full border rounded-lg px-3 py-2" placeholder="https://.../image.jpg" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-2">Preview</div>
                  <div className="border rounded-lg overflow-hidden h-24 bg-gray-50 flex items-center justify-center">
                    {filePreview || thumbnail ? (
                      <img src={filePreview || thumbnail} alt="Preview" className="w-full h-full object-cover" onError={() => { /* ignore */ }} />
                    ) : (
                      <span className="text-xs text-gray-400">No image</span>
                    )}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Or upload image</label>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={saving}
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0];
                      if (f) {
                        setFile(f);
                        setThumbnail('');
                        const url = URL.createObjectURL(f);
                        setFilePreview(url);
                      } else {
                        setFile(null);
                        setFilePreview('');
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">Supported: JPG, PNG, GIF, WEBP</p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-gray-600">
              <p className="mb-2 font-medium">Assessments</p>
              <p className="text-sm">Create quizzes and assignments per lesson in the builder. Quiz builder is coming next.</p>
            </div>
          )}

          {step === 4 && (
            <div className="text-gray-600">
              <p className="mb-2 font-medium">Publish</p>
              <p className="text-sm">You can set visibility and publish the course after creation.</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/admin/courses')}>Cancel</Button>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>
            )}
            {step < steps.length - 1 && (
              <Button onClick={() => canContinue() && setStep(step + 1)} disabled={!canContinue()}>Continue</Button>
            )}
            {step === steps.length - 1 && (
              <Button onClick={handleCreate} disabled={!canContinue() || saving}>{saving ? 'Creating…' : 'Create Course'}</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


