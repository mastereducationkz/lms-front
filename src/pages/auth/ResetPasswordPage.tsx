import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, KeyRound, ArrowLeft } from 'lucide-react';
import { resetPassword } from '../../services/api/auth';
import { toast } from '../../components/Toast';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { passwordHint, passwordPolicyError } from '../../lib/passwordPolicy';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/publicPages';

export default function ResetPasswordPage() {
  const t = useT();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const policyError = passwordPolicyError(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (policyError) {
      toast(policyError, 'error');
      return;
    }
    if (password !== confirm) {
      toast(t('publicPages.auth.reset.mismatch'), 'error');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      toast(t('publicPages.auth.reset.done'), 'success');
      navigate('/login', { replace: true });
    } catch (err: any) {
      toast(err.message || t('publicPages.auth.reset.failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-5 h-5 text-brand" />
          <h1 className="text-lg font-semibold text-foreground">{t('publicPages.auth.reset.title')}</h1>
        </div>

        {!token ? (
          <>
            <p className="text-sm text-muted-foreground mt-2">
              {t('publicPages.auth.reset.invalidLink')}
            </p>
            <Link to="/forgot-password" className="inline-flex items-center gap-1.5 text-sm text-brand mt-5 hover:underline">
              <ArrowLeft className="w-4 h-4" /> {t('publicPages.auth.reset.requestNew')}
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-5">{t('publicPages.auth.reset.intro')}</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-sm font-medium">{t('publicPages.auth.reset.newPassword')}</Label>
                <Input
                  id="password"
                  type="password"
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={passwordHint()}
                  autoComplete="new-password"
                  aria-invalid={!!password && !!policyError}
                  aria-describedby="password-error"
                  className="mt-1.5"
                />
                {password && policyError && <p id="password-error" className="mt-1 text-xs text-destructive">{policyError}</p>}
              </div>
              <div>
                <Label htmlFor="confirm" className="text-sm font-medium">{t('publicPages.auth.reset.confirmPassword')}</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={mismatch}
                  aria-describedby="confirm-error"
                  className="mt-1.5"
                />
                {mismatch && <p id="confirm-error" className="mt-1 text-xs text-destructive">{t('publicPages.auth.reset.mismatch')}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loading || !!policyError || password !== confirm}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('publicPages.auth.reset.saving')}</> : t('publicPages.auth.reset.submit')}
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
