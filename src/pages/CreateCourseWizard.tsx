import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stepper from '../components/Stepper.tsx';
import Button from '../components/Button.tsx';
import apiClient from '../services/api';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/courseAuthoring';

export default function CreateCourseWizard() {
  const navigate = useNavigate();
  const tr = useT();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string>('');
  const [thumbnail, setThumbnail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>('');

  const steps = [tr('courseAuthoring.wizard.details'), tr('courseAuthoring.wizard.curriculum'), tr('courseAuthoring.wizard.content'), tr('courseAuthoring.wizard.assessments'), tr('courseAuthoring.wizard.publish')];

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
      alert(tr('courseAuthoring.create.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{tr('courseAuthoring.create.title')}</h1>
      <div className="card p-6">
        <Stepper steps={steps} current={step} onStepChange={setStep} />

        <div className="mt-6">
          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{tr('courseAuthoring.wizard.courseTitle')}</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" placeholder={tr('courseAuthoring.wizard.titlePlaceholder')} />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">{tr('courseAuthoring.wizard.thumbnailUrl')}</label>
                <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="https://.../image.jpg" />
                {thumbnail && (
                  <div className="mt-3">
                    <img src={thumbnail} alt={tr('courseAuthoring.create.previewAlt')} className="w-full h-40 object-cover rounded-lg border" onError={() => { /* silent */ }} />
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">{tr('courseAuthoring.create.descriptionLabel')}</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" rows={4} placeholder={tr('courseAuthoring.wizard.descriptionPlaceholder')} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">{tr('courseAuthoring.create.tags')}</label>
                <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder={tr('courseAuthoring.wizard.tagsPlaceholder')} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="text-gray-600">
              <p className="mb-2 font-medium">{tr('courseAuthoring.wizard.curriculum')}</p>
              <p className="text-sm">{tr('courseAuthoring.wizard.curriculumHint')}</p>
            </div>
          )}

          {step === 2 && (
            <div className="text-gray-600">
              <p className="mb-2 font-medium">{tr('courseAuthoring.wizard.content')}</p>
              <p className="text-sm">{tr('courseAuthoring.wizard.contentHint')}</p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr('courseAuthoring.wizard.thumbnailUrl')}</label>
                  <input value={thumbnail} onChange={(e) => { setThumbnail(e.target.value); setFile(null); setFilePreview(''); }} className="w-full border rounded-lg px-3 py-2" placeholder="https://.../image.jpg" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-2">{tr('courseAuthoring.create.previewAlt')}</div>
                  <div className="border rounded-lg overflow-hidden h-24 bg-gray-50 flex items-center justify-center">
                    {filePreview || thumbnail ? (
                      <img src={filePreview || thumbnail} alt={tr('courseAuthoring.create.previewAlt')} className="w-full h-full object-cover" onError={() => { /* ignore */ }} />
                    ) : (
                      <span className="text-xs text-gray-400">{tr('courseAuthoring.wizard.noImage')}</span>
                    )}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{tr('courseAuthoring.wizard.orUpload')}</label>
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
                  <p className="text-xs text-gray-500 mt-1">{tr('courseAuthoring.wizard.supported')}</p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-gray-600">
              <p className="mb-2 font-medium">{tr('courseAuthoring.wizard.assessments')}</p>
              <p className="text-sm">{tr('courseAuthoring.wizard.assessmentsHint')}</p>
            </div>
          )}

          {step === 4 && (
            <div className="text-gray-600">
              <p className="mb-2 font-medium">{tr('courseAuthoring.wizard.publish')}</p>
              <p className="text-sm">{tr('courseAuthoring.wizard.publishHint')}</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/admin/courses')}>{tr('common.cancel')}</Button>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>{tr('common.back')}</Button>
            )}
            {step < steps.length - 1 && (
              <Button onClick={() => canContinue() && setStep(step + 1)} disabled={!canContinue()}>{tr('courseAuthoring.courseCard.continue')}</Button>
            )}
            {step === steps.length - 1 && (
              <Button onClick={handleCreate} disabled={!canContinue() || saving}>{saving ? tr('courseAuthoring.create.creating') : tr('courseAuthoring.create.title')}</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


