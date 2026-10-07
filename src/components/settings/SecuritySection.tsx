import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useAuth } from '../../contexts/AuthContext';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';
import { passwordPolicyError } from '../../lib/passwordPolicy';
import { changePassword } from '../../services/api/auth';
import { signOutOtherDevices } from '../../services/sessions';
import { SettingsRow, SettingsSection } from './SettingsSection';

/**
 * Security (owner Q18, 2026-10-07):
 *  - a new password signs out EVERY device, this one included: say so before and after, then
 *    take the person to sign-in (the server has already refused this device's tokens);
 *  - «Sign out other devices» ends every other session and keeps this one (services/sessions).
 */
export default function SecuritySection() {
  const t = useT();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const policyError = passwordPolicyError(next);
  const mismatch = confirm.length > 0 && next !== confirm;
  const ready = !!current && !policyError && next === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    try {
      await changePassword(current, next);
    } catch (err) {
      toast.error((err as Error).message || t('settings.password.failed'));
      setSaving(false);
      return;
    }
    // Every session ended on the server, this one too: leave cleanly and say why.
    toast.success(t('settings.password.doneTitle'), { description: t('settings.password.doneBody'), duration: 15000 });
    await logout();
    navigate('/login', { replace: true });
  };

  const signOutOthers = async () => {
    setRevoking(true);
    try {
      const count = await signOutOtherDevices();
      toast.success(count > 0 ? t('settings.sessions.done', { count }) : t('settings.sessions.none'));
    } catch {
      toast.error(t('settings.sessions.failed'));
    } finally {
      setRevoking(false);
    }
  };

  return (
    <SettingsSection id="security" title={t('settings.security.title')} description={t('settings.security.description')}>
      <form onSubmit={submit} className="px-4 py-4 sm:px-5" noValidate>
        <div className="text-sm font-medium text-foreground">{t('settings.password.title')}</div>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('settings.password.signsOut')}</p>
        <div className="mt-4 grid max-w-sm gap-4">
          <div>
            <label htmlFor="pw-current" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('settings.password.current')}
            </label>
            <Input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pw-new" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('settings.password.new')}
            </label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder={t('settings.password.newPlaceholder')}
              aria-invalid={!!next && !!policyError}
              aria-describedby="pw-new-error"
            />
            {next && policyError && (
              <p id="pw-new-error" className="mt-1 text-xs text-destructive">
                {policyError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="pw-confirm" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('settings.password.confirm')}
            </label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch}
              aria-describedby="pw-confirm-error"
            />
            {mismatch && (
              <p id="pw-confirm-error" className="mt-1 text-xs text-destructive">
                {t('settings.password.mismatch')}
              </p>
            )}
          </div>
          <div>
            <Button type="submit" disabled={saving || !ready} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {saving ? t('settings.password.saving') : t('settings.password.submit')}
            </Button>
          </div>
        </div>
      </form>
      <SettingsRow label={t('settings.sessions.title')} description={t('settings.sessions.description')}>
        <Button type="button" variant="outline" disabled={revoking} onClick={signOutOthers} className="gap-2">
          {revoking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
          {t('settings.sessions.action')}
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}
