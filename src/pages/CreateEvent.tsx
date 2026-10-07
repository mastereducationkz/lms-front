import { useNavigate } from 'react-router-dom';
import EventForm from '../components/EventForm';
import type { Event } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function CreateEvent() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSave = (event: Event) => {
    // Navigate back to calendar after successful creation
    navigate('/calendar', {
      state: { message: `Event "${event.title}" created successfully` }
    });
  };

  const handleCancel = () => {
    // Navigate back to appropriate page based on role
    if (user?.role === 'admin' || user?.role === 'head_teacher') {
      navigate('/admin/events');
    } else {
      navigate('/calendar');
    }
  };

  return (
    <EventForm
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
