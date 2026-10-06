/**
 * The one avatar for a person (owner, 2026-10-04): a real photo if they have one, else — for a
 * student — their orca (the one they chose, or the automatic one from their id), else initials.
 */
import Orca from './Orca';
import { resolveMascot } from './config';

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
  fallbackClassName = 'bg-brand-solid text-white',
}: UserAvatarProps) {
  const box = { width: size, height: size };
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" style={box} className={`rounded-full object-cover shrink-0 ${className}`} />;
  }
  if (isStudent && userId != null && userId !== '') {
    return (
      <Orca
        config={resolveMascot(mascot, userId)}
        size={size}
        title={name ? `${name}'s orca` : 'Orca avatar'}
        className={`rounded-full shrink-0 ${className}`}
      />
    );
  }
  return (
    <div
      style={{ ...box, fontSize: Math.max(10, Math.round(size * 0.36)) }}
      className={`rounded-full flex items-center justify-center font-semibold shrink-0 ${fallbackClassName} ${className}`}
    >
      {initialsOf(name)}
    </div>
  );
}
