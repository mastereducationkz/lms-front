/**
 * The one avatar for a person (owner, 2026-10-04): a real photo if they have one, else — for a
 * student — their orca (the one they chose, or the automatic one from their id), else initials.
 */
import Orca from './Orca';
import { resolveMascot } from './config';
import { t } from '../../lib/i18n';
import { useSeason } from '../../seasonal/SeasonProvider';
import { SeasonSlot } from '../../seasonal/SeasonSlot';
import '@/lib/i18n/catalogs/sharedUi';

interface UserAvatarProps {
  userId?: number | string | null;
  name?: string | null;
  avatarUrl?: string | null;
  mascot?: string | null;
  /** Only students get an orca; everyone else keeps initials. */
  isStudent?: boolean;
  /** Pixel size of the circle. */
  size?: number;
  className?: string;
  /** Classes for the initials circle (colour, text size). */
  fallbackClassName?: string;
}

export function initialsOf(name?: string | null): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join('') || 'U').toUpperCase();
}

export default function UserAvatar({
  userId,
  name,
  avatarUrl,
  mascot,
  isStudent = false,
  size = 40,
  className = '',
  fallbackClassName = 'bg-brand-solid text-brand-solid-foreground',
}: UserAvatarProps) {
  // In a season everyone wears a costume (src/seasonal): the avatar sits in a box of its own size
  // that takes the caller's classes, and the costume is drawn inside that box.
  const dressed = useSeason().decorate;
  const outer = dressed ? '' : className;
  const box = { width: size, height: size };
  let avatar: React.ReactElement;
  if (avatarUrl) {
    avatar = <img src={avatarUrl} alt="" style={box} className={`rounded-full object-cover shrink-0 ${outer}`} />;
  } else if (isStudent && userId != null && userId !== '') {
    avatar = (
      <Orca
        config={resolveMascot(mascot, userId)}
        size={size}
        title={name ? t('sharedUi.mascot.avatarOf', { name }) : t('sharedUi.mascot.avatar')}
        className={`rounded-full shrink-0 ${outer}`}
      />
    );
  } else {
    avatar = (
      <div
        style={{ ...box, fontSize: Math.max(10, Math.round(size * 0.36)) }}
        className={`rounded-full flex items-center justify-center font-semibold shrink-0 ${fallbackClassName} ${outer}`}
      >
        {initialsOf(name)}
      </div>
    );
  }
  if (!dressed) return avatar;
  return (
    <span style={{ ...box, lineHeight: 0 }} className={`relative inline-block shrink-0 align-middle ${className}`}>
      {avatar}
      <SeasonSlot name="avatar" size={size} seed={userId ?? name} />
    </span>
  );
}
