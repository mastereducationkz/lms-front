/**
 * Profile = who you are (owner, 2026-10-07): the avatar with the Kasatik customiser, name, email
 * and role, your groups with their teacher and curator, and for a student the exam date, target
 * score and achievements; for a teacher, whether others may ask them to substitute. How the app
 * works — theme, password, notifications — is in Settings.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BellOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
import OrcaBuilder from '@/components/mascot/OrcaBuilder';
import { ORCA_SECTION_ID } from '@/components/mascot/KasatikSpotlight';
import { AchievementsTile } from '@/components/achievements/AchievementsTile';
import { TargetsTile } from '@/components/dashboard/TargetsTile';
import ProfileIdentity from '@/components/profile/ProfileIdentity';
import ProfileGroups, { hasOwnGroups } from '@/components/profile/ProfileGroups';
import ProfileExam from '@/components/profile/ProfileExam';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/profile';

/** A teacher's opt-out from substitution requests (who other teachers can ask to cover a lesson). */
function SubstitutionToggle() {
  const t = useT();
  const { user, refreshUser } = useAuth();
  const [on, setOn] = useState(!!user?.no_substitutions);
  const [saving, setSaving] = useState(false);

  useEffect(() => setOn(!!user?.no_substitutions), [user?.no_substitutions]);

  const toggle = async () => {
    try {
      setSaving(true);
      await apiClient.updateSubstitutionPreference(!on);
      setOn(!on);
      await refreshUser();
    } catch (error) {
      console.error('Failed to update substitution preference:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex items-center gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <BellOff className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p id="profile-subs-title" className="font-medium text-foreground">{t('profile.substitutions.title')}</p>
        <p className="text-sm text-muted-foreground">{t('profile.substitutions.body')}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="profile-subs-title"
        onClick={toggle}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-wait disabled:opacity-60 ${
          on ? 'bg-brand-solid' : 'bg-gray-300 dark:bg-secondary'
        }`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </section>
  );
}

export default function ProfilePage() {
  const t = useT();
  const { user } = useAuth();
  const location = useLocation();
  const isStudent = user?.role === 'student';

  // «Try it on» (?try=…) and «Meet your Kasatik → Customize» (#your-orca) arrive with the
  // customiser open. The try param keys the builder, so a second «Try it on» from this very page
  // remounts it wearing the new part.
  const tryParam = new URLSearchParams(location.search).get('try');
  const wantsBuilder = !!tryParam || location.hash === `#${ORCA_SECTION_ID}`;
  const [builderOpen, setBuilderOpen] = useState(wantsBuilder);
  useEffect(() => {
    if (wantsBuilder) setBuilderOpen(true);
  }, [wantsBuilder, location.key]);

  if (!user) return null;

  return (
    <div className="@container mx-auto w-full max-w-5xl space-y-6">
      <h1 className="text-3xl font-bold text-foreground">{t('profile.title')}</h1>

      <ProfileIdentity customiserOpen={builderOpen} onToggleCustomiser={isStudent ? () => setBuilderOpen((o) => !o) : undefined} />

      {isStudent && builderOpen && (
        <div id="profile-orca">
          <OrcaBuilder key={tryParam ?? 'builder'} />
        </div>
      )}

      {(hasOwnGroups(user.role) || isStudent) && (
        // Two columns once there is room; a column whose cards all hide themselves (no exam
        // track, targets off) collapses and the other takes the full width.
        <div className="grid items-start gap-6 @3xl:grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] [&>*:empty]:hidden">
          {hasOwnGroups(user.role) && <ProfileGroups role={user.role} />}
          {isStudent && (
            <div className="space-y-6 [&>*]:mt-0">
              <ProfileExam />
              <TargetsTile />
            </div>
          )}
        </div>
      )}

      {/* Work availability, not app behaviour: it stays on Profile, under the groups. */}
      {user.role === 'teacher' && <SubstitutionToggle />}

      {isStudent && <div className="[&>*]:mt-0"><AchievementsTile /></div>}
    </div>
  );
}
