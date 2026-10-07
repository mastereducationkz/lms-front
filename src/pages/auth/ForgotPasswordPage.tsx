import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { forgotPassword } from '../../services/api/auth';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/publicPages';

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;
    setLoading(true);
    try {
      await forgotPassword(email.trim());
    } catch {
      // Always succeed-looking (no user enumeration)
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        {sent ? (
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h1 className="text-lg font-semibold text-foreground">{t('publicPages.auth.forgot.sentTitle')}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {t('publicPages.auth.forgot.sentText').split(/(\{email\})/).map((part, i) => (part === '{email}' ? <strong key={i}>{email}</strong> : part))}
            </p>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-brand mt-5 hover:underline">
              <ArrowLeft className="w-4 h-4" /> {t('publicPages.auth.backToSignIn')}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-semibold text-foreground">{t('publicPages.auth.forgot.title')}</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              {t('publicPages.auth.forgot.intro')}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm font-medium">{t('publicPages.auth.forgot.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('publicPages.auth.forgot.emailPlaceholder')}
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('publicPages.auth.forgot.sending')}</> : t('publicPages.auth.forgot.submit')}
              </Button>
            </form>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mt-5 hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> {t('publicPages.auth.backToSignIn')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
