/**
 * Costumes for everyone (owner, 2026-10-26): every avatar wears a witch hat, cat ears or a little
 * pumpkin until the season ends — the same one for the same person everywhere. Drawn inside the
 * avatar's own box (the leaderboard grid shows 26 px avatars side by side), and skipped below 22 px.
 */
import { CatEars, Pumpkin, WitchHat } from './art';

const KINDS = ['hat', 'ears', 'pumpkin'] as const;

function kindFor(seed: string | number | null | undefined): (typeof KINDS)[number] {
  const text = String(seed ?? '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return KINDS[Math.abs(hash) % KINDS.length];
}

export default function AvatarCostume({ size, seed }: { size: number; seed?: string | number | null }) {
  if (size < 22) return null;
  const kind = kindFor(seed);
  if (kind === 'hat') {
    const hat = Math.round(size * 0.56);
    return <WitchHat size={hat} className="pointer-events-none absolute right-0 top-0 rotate-[16deg]" style={{ marginTop: -hat * 0.08 }} />;
  }
  if (kind === 'ears') {
    return <CatEars size={Math.round(size * 0.92)} className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2" />;
  }
  const pumpkin = Math.round(size * 0.42);
  return <Pumpkin size={pumpkin} plain className="pointer-events-none absolute bottom-0 right-0" />;
}
