import { useNavigate, useSearchParams } from 'react-router-dom';
import EventForm from '../components/EventForm';
import Loader from '../components/Loader';
import type { Event } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { isOpenRole } from '../components/open-webinars/accessModel';
import { duplicateIdOf } from '../components/open-webinars/duplicate';
import { useDuplicateDraft } from '../components/open-webinars/useDuplicateDraft';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

export default function CreateEvent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = useT();
  // «Duplicate» of an open webinar: `?duplicate=<id>` starts the form from that webinar (the roles that run them only).
  const [search] = useSearchParams();
  const duplicate = useDuplicateDraft(isOpenRole(user?.role) ? duplicateIdOf(search) : null);

  const handleSave = (event: Event) => {
    // Navigate back to calendar after successful creation
    navigate('/calendar', {
      state: { message: `Event "${event.title}" created successfully` }
    });
  };

  // The event exists but its public access did not save: its edit page shows the card with the reason.
  const handleAccessFailed = (event: Event, message: string) => {
    navigate(`/admin/events/${event.id}/edit`, { state: { accessError: message } });
  };

  const handleCancel = () => {
    // Navigate back to appropriate page based on role
    if (user?.role === 'admin' || user?.role === 'head_teacher') {
      navigate('/admin/events');
    } else {
      navigate('/calendar');
    }
  };

  if (duplicate.status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader size="xl" animation="spin" color="hsl(var(--brand))" />
      </div>
    );
  }

  return (
    <>
      {duplicate.status === 'failed' && (
        <p role="alert" data-duplicate-failed className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 text-sm text-red-600 dark:text-red-400">
          {t('openWebinars.admin.duplicate.loadFailed', { message: duplicate.message })}
        </p>
      )}
      <EventForm
        onSave={handleSave}
        onCancel={handleCancel}
        onAccessFailed={handleAccessFailed}
        duplicate={duplicate.status === 'ready' ? duplicate.draft : undefined}
      />
    </>
  );
}
