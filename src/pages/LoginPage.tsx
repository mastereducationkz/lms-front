import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { SignInPage, Testimonial } from '../components/SignInPage.tsx';

export default function LoginPage() {
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
        setError(result.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
        title={<span className="font-light text-foreground tracking-tighter">Welcome to LMS</span>}
        description="Access your account and continue your learning journey with us"
        heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
        onSignIn={handleSignIn}
        onBackToHome={handleBackToHome}
        error={error}
        loading={loading}
      />
    </div>
  );
}
