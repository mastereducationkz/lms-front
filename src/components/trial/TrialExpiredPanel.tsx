import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { clearCache } from '../../services/api';
import { Clock } from 'lucide-react';

// Contact link reused from the landing page footer (src/components/landing/Footer.tsx),
// which lists info@mastereducation.kz as the support contact (no mailto/tel link exists
// there today — this wraps the same address as a mailto: link).
const CONTACT_HREF = 'mailto:info@mastereducation.kz';

const TrialExpiredPanel: React.FC = () => {
  const { logout } = useAuth();

  // Trial has ended: drop any cached course/lesson data so nothing stale lingers
  // once access is restored later (fresh grant, etc.).
  useEffect(() => {
    clearCache();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock className="w-7 h-7 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Your trial has ended</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Thanks for exploring Master Education! To continue learning with full access,
          contact our team — we'll set you up in minutes.
        </p>
        <a
          href={CONTACT_HREF}
          target="_blank"
          rel="noreferrer"
          className="inline-block w-full px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 mb-3"
        >
          Contact us to continue
        </a>
        <button onClick={() => logout()} className="text-sm text-gray-500 hover:text-gray-700">
          Log out
        </button>
      </div>
    </div>
  );
};

export default TrialExpiredPanel;
