import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import EventForm from '../components/EventForm';
import Loader from '../components/Loader';
import OpenAccessCard from '../components/open-webinars/OpenAccessCard';
import { getEventDetails } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Event } from '../types';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/adminTools';
import '@/lib/i18n/catalogs/adminPages';

export default function EditEvent() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const t = useT();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventId) {
      loadEvent();
    }
  }, [eventId]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      const eventData = await getEventDetails(parseInt(eventId!));
      setEvent(eventData);
    } catch (error: any) {
      setError(error.message || t('adminTools.events.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (updatedEvent: Event) => {
    navigate('/admin/events', {
      state: { message: t('adminPages.events.edit.updated', { title: updatedEvent.title }) }
    });
  };

  const handleCancel = () => {
    navigate('/admin/events');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader size="xl" animation="spin" color="hsl(var(--brand))" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-2">{t('adminPages.events.edit.loadingError')}</h2>
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button 
            onClick={() => navigate('/admin/events')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            {t('adminPages.events.edit.backToList')}
          </button>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-400 mb-2">{t('adminPages.events.edit.notFound')}</h2>
          <p className="text-yellow-600 dark:text-yellow-400">{t('adminPages.events.edit.notFoundHint')}</p>
          <button 
            onClick={() => navigate('/admin/events')}
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            {t('adminPages.events.edit.backToList')}
          </button>
        </div>
      </div>
    );
  }

  // Set by the create form when the event was made but its public access did not save.
  const accessError = (location.state as { accessError?: string } | null)?.accessError ?? null;

  // A head curator cannot edit events (that is for admins and head teachers) but may open a webinar to everyone:
  // they get the access card alone, which is where the create form sends them when saving the access failed.
  if (user?.role === 'head_curator') {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        <h1 className="text-2xl font-bold text-foreground">{event.title}</h1>
        <OpenAccessCard eventId={event.id} initialError={accessError} />
      </div>
    );
  }

  return (
    <EventForm
      event={event}
      onSave={handleSave}
      onCancel={handleCancel}
      accessError={accessError}
    />
  );
}
