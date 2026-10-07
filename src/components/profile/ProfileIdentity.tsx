/**
 * Profile: who you are — avatar, name (editable), role, email, student ID, member since. A student's
 * avatar is their orca and opens the Kasatik customiser. How the app works (theme, password,
 * notifications) lives in Settings; this card links there.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Mail, Pencil, Settings, Shirt } from 'lucide-react';
import UserAvatar from '@/components/mascot/UserAvatar';
import UnsavedChangesDialog from '@/components/UnsavedChangesDialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import apiClient from '@/services/api';
import { roleLabel } from '@/lib/roleLabel';
import { formatDate } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/profile';

interface ProfileIdentityProps {
  /** Students: the orca customiser below is open. */
  customiserOpen?: boolean;
  onToggleCustomiser?: () => void;
}

export default function ProfileIdentity({ customiserOpen = false, onToggleCustomiser }: ProfileIdentityProps) {
  const t = useT();
  const locale = useLocale();
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const isStudent = user?.role === 'student';

  useEffect(() => {
    if (!editing) setName(user?.name ?? '');
  }, [user?.name, editing]);

  const dirty = editing && name.trim() !== '' && name.trim() !== (user?.name ?? '');
  const { confirmLeave, cancelLeave, isBlocked } = useUnsavedChangesWarning({
    hasUnsavedChanges: dirty,
    message: t('profile.unsavedBody'),
    onConfirmLeave: () => setEditing(false),
  });

  if (!user) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!dirty) {
      setEditing(false);
      return;
    }
    try {
      setSaving(true);
      await apiClient.updateProfile(Number(user.id), { name: name.trim() });
      await refreshUser();
      setEditing(false);
      toast(t('profile.nameSaved'), 'success');
    } catch {
      toast(t('profile.nameFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const avatar = (
    <UserAvatar userId={user.id} name={user.name} avatarUrl={user.avatar_url} mascot={user.mascot} isStudent={isStudent} size={88} />
  );

  return (
    <section className="@container rounded-lg border bg-card p-5 text-card-foreground shadow-sm @lg:p-6" aria-label={t('profile.title')}>
      <div className="flex flex-col gap-5 @xl:flex-row @xl:items-center">
        {isStudent && onToggleCustomiser ? (
          // The orca itself opens the customiser too: a pointer shortcut for the button beside the
          // name, so it stays out of the tab order and the accessibility tree.
          <button
            type="button"
            onClick={onToggleCustomiser}
            tabIndex={-1}
            aria-hidden="true"
            title={t('profile.customise')}
            className="group relative shrink-0 self-start rounded-full"
          >
            {avatar}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-brand-solid text-brand-solid-foreground shadow-sm transition-transform group-hover:scale-105 motion-reduce:transition-none">
              <Shirt className="h-4 w-4" aria-hidden />
            </span>
          </button>
        ) : (
          <div className="shrink-0 self-start">{avatar}</div>
        )}

        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={save} className="flex flex-wrap items-center gap-2">
              <label htmlFor="profile-name" className="sr-only">{t('profile.nameLabel')}</label>
              <input
                id="profile-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('profile.namePlaceholder')}
                className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring @md:w-auto @md:flex-1"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={saving || !name.trim()}>{t('common.save')}</Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>{t('common.cancel')}</Button>
              </div>
            </form>
          ) : (
            <div className="flex min-w-0 items-center gap-1">
              <h2 className="truncate text-2xl font-semibold leading-tight text-foreground" title={user.name}>{user.name}</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => setEditing(true)} aria-label={t('profile.editName')} title={t('profile.editName')}>
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="rounded-full bg-brand-subtle px-2.5 py-0.5 text-xs font-semibold text-brand-subtle-foreground">
              <span className="sr-only">{t('profile.role')}: </span>{roleLabel(user.role, locale)}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              <span className="sr-only">{t('profile.email')}: </span>
              <span className="truncate">{user.email}</span>
            </span>
            {user.student_id && <span>{t('profile.studentId')} {user.student_id}</span>}
            {user.created_at && <span>{t('profile.memberSince', { date: formatDate(user.created_at, { day: 'numeric', month: 'long', year: 'numeric' }, locale) })}</span>}
          </div>
        </div>

        {isStudent && onToggleCustomiser && (
          <Button variant="outline" className="shrink-0 self-start @xl:self-center" onClick={onToggleCustomiser} aria-expanded={customiserOpen} aria-controls="profile-orca">
            {customiserOpen ? <Check className="mr-2 h-4 w-4" aria-hidden /> : <Shirt className="mr-2 h-4 w-4" aria-hidden />}
            {customiserOpen ? t('profile.customiseDone') : t('profile.customise')}
          </Button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">{t('profile.settingsHint')}</p>
        <Button asChild variant="ghost" size="sm" className="group/settings -mr-2">
          <Link to="/settings">
            <Settings className="mr-2 h-4 w-4" aria-hidden />
            {t('profile.openSettings')}
            <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover/settings:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          </Link>
        </Button>
      </div>

      <UnsavedChangesDialog open={isBlocked} onConfirm={confirmLeave} onCancel={cancelLeave} title={t('profile.unsavedTitle')} description={t('profile.unsavedBody')} />
    </section>
  );
}
