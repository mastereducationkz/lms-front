import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { Button } from './ui/button';
import { RotateCcw } from 'lucide-react';

export default function ResetOnboardingButton() {
  const { user } = useAuth();

  const handleReset = () => {
    if (user) {
      storage.removeItem(`onboarding_completed_${user.id}`);
      console.log('Onboarding reset for user:', user.id);
      console.log('Note: Server-side onboarding status is NOT reset. This only affects local storage.');
      alert('Onboarding reset locally! Reload the page to see it again.\n\nNote: To fully reset, you need to update the database directly.');
      window.location.reload();
    }
  };

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <Button
      onClick={handleReset}
      variant="outline"
      size="sm"
      className="border-yellow-400 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-950/30"
    >
      <RotateCcw className="w-4 h-4 mr-2" />
      Reset Onboarding
    </Button>
  );
}
