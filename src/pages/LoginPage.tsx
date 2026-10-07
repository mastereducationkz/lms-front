import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { SignInPage, Testimonial } from '../components/SignInPage.tsx';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/publicPages';

export default function LoginPage() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Keep the query too: a Telegram deep link like /materials?lesson=12 must survive the login.
  const fromLocation = location.state?.from;
  const from = fromLocation?.pathname ? `${fromLocation.pathname}${fromLocation.search || ''}` : '/dashboard';

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const result = await login(email, password);
      
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.error || t('publicPages.login.failed'));
      }
    } catch (err: any) {
      setError(err.message || t('publicPages.login.failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="bg-background text-foreground">
      <SignInPage
        title={<span className="font-light text-foreground tracking-tighter">{t('publicPages.login.title')}</span>}
        description={t('publicPages.login.description')}
        heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
        onSignIn={handleSignIn}
        onBackToHome={handleBackToHome}
        error={error}
        loading={loading}
      />
    </div>
  );
}
