/**
 * Profile: the groups a person belongs to, each with its teacher and curator. Students learn in
 * them (and can message their teacher or curator from here), teachers teach them, curators curate
 * them. Other roles have no groups of their own, so the card isn't shown for them.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Users } from 'lucide-react';
import UserAvatar from '@/components/mascot/UserAvatar';
import { getMyGroups, getTeacherGroups } from '@/services/api/groups';
import { getCuratorGroups } from '@/services/api/curator';
import { getAvailableContacts } from '@/services/api/chat';
import { groupsFromStaffRows, groupsWithContacts, programChip, type ProfileGroup, type ProfilePerson } from '@/lib/profileGroups';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/profile';

type GroupsRole = 'student' | 'teacher' | 'curator';

export const hasOwnGroups = (role: string | undefined): role is GroupsRole =>
  role === 'student' || role === 'teacher' || role === 'curator';

async function loadGroups(role: GroupsRole): Promise<ProfileGroup[]> {
  if (role === 'student') {
    const [groups, contacts] = await Promise.all([getMyGroups(), getAvailableContacts()]);
    return groupsWithContacts(groups, contacts);
  }
  // A teacher's /admin/groups is scoped to their own groups; curators read their own list.
  return groupsFromStaffRows(role === 'teacher' ? await getTeacherGroups(200, false) : await getCuratorGroups());
}

function Person({ label, person, canMessage }: { label: string; person: ProfilePerson | null; canMessage: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {person ? (
        <UserAvatar userId={person.id} name={person.name} avatarUrl={person.avatarUrl} size={32} />
      ) : (
        <span aria-hidden className="h-8 w-8 shrink-0 rounded-full border border-dashed border-border" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`truncate text-sm ${person ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
          {person ? person.name : t('profile.groups.notAssigned')}
        </p>
      </div>
      {person && canMessage && (
        <button
          type="button"
          onClick={() => navigate('/chat', { state: { contactUserId: person.id } })}
          aria-label={t('profile.groups.message', { name: person.name })}
          title={t('profile.groups.message', { name: person.name })}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

export default function ProfileGroups({ role }: { role: GroupsRole }) {
  const t = useT();
  const [groups, setGroups] = useState<ProfileGroup[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setGroups(null);
    setFailed(false);
    loadGroups(role)
      .then((rows) => { if (alive) setGroups(rows); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [role]);

  const title = role === 'student' ? t('profile.groups.student') : role === 'teacher' ? t('profile.groups.teacher') : t('profile.groups.curator');

  return (
    <section className="@container rounded-lg border bg-card p-5 text-card-foreground shadow-sm @lg:p-6" aria-labelledby="profile-groups-title">
      <h2 id="profile-groups-title" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Users className="h-4 w-4" aria-hidden />
        {title}
      </h2>

      {failed ? (
        <p className="mt-4 text-sm text-muted-foreground">{t('profile.groups.loadFailed')}</p>
      ) : groups === null ? (
        <div className="mt-4 space-y-3" aria-hidden>
          {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : groups.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{role === 'student' ? t('profile.groups.empty') : t('profile.groups.emptyStaff')}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {groups.map((g) => {
            const chip = programChip(g.program);
            return (
              <li key={g.id} className="rounded-xl border border-border p-4">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 flex-1 truncate font-medium text-foreground" title={g.name}>{g.name}</p>
                  {chip && (
                    <span className="shrink-0 rounded-full bg-brand-subtle px-2 py-0.5 text-[11px] font-semibold text-brand-subtle-foreground">
                      {chip}
                    </span>
                  )}
                </div>
                <div className="mt-3 grid gap-3 @md:grid-cols-2">
                  {role !== 'teacher' && <Person label={t('profile.groups.teacherLabel')} person={g.teacher} canMessage={role === 'student'} />}
                  {role !== 'curator' && <Person label={t('profile.groups.curatorLabel')} person={g.curator} canMessage={role === 'student'} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
