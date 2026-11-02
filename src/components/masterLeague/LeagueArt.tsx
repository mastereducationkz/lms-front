/**
 * The season's own decoration on the League screens: the large quiet motif behind the banner and the
 * emblem beside Kasatik. Football keeps the Master emblem and the crest, drawn exactly as before.
 * Studio groups get original album-mood art in their palette (owner, 2026-11-02; no covers, no
 * artists): Off-Season an empty court at sunrise, Section.80 a cassette, any other a record.
 */
import { MasterMark } from '@/components/mascot/art/MasterMark';
import { LeagueCrestSvg } from '@/components/mascot/art/LeagueCrest';
import { StudioEmblemSvg } from '@/components/mascot/art/StudioEmblem';
import type { LeagueLook } from './leagueLook';

const MOTIF = 'pointer-events-none absolute -right-10 -top-14 h-64 w-64 @lg:h-80 @lg:w-80';

/** Dawn on an empty court: the sun half over the horizon, its rays, the three-point arc and the lane. */
function DawnCourt() {
  return (
    <g fill="none" strokeLinecap="round">
      <circle cx="100" cy="118" r="44" fill="#F08A4B" opacity="0.1" />
      <circle cx="100" cy="118" r="30" fill="#F7A56B" opacity="0.08" />
      <g stroke="#FBC9A2" strokeWidth="3" opacity="0.09">
        {[-70, -45, -20, 0, 20, 45, 70].map((a) => (
          <path key={a} d="M100 66 V44" transform={`rotate(${a} 100 118)`} />
        ))}
      </g>
      <path d="M8 118 H192" stroke="#fff" strokeWidth="3" opacity="0.07" />
      <g stroke="#fff" strokeWidth="2.6" opacity="0.06">
        <path d="M30 196 Q100 132 170 196" />
        <path d="M78 196 L86 140 H114 L122 196" />
        <path d="M86 140 Q100 152 114 140" />
      </g>
    </g>
  );
}

/** A cassette: shell, label with a few tracklist lines, two reels, the tape window. */
function Cassette() {
  return (
    <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" opacity="0.12">
      <rect x="18" y="48" width="164" height="104" rx="12" strokeWidth="4" />
      <rect x="32" y="60" width="136" height="58" rx="6" strokeWidth="3" />
      {[72, 82, 92].map((y) => <path key={y} d={`M42 ${y} H${y === 92 ? 110 : 158}`} strokeWidth="2.4" />)}
      <rect x="62" y="98" width="76" height="16" rx="8" strokeWidth="2.6" />
      {[78, 122].map((x) => (
        <g key={x}>
          <circle cx={x} cy="106" r="6" strokeWidth="2.6" />
          <path d={`M${x - 4} 106 H${x + 4} M${x} 102 V110`} strokeWidth="2" />
        </g>
      ))}
      <path d="M50 152 L58 132 H142 L150 152" strokeWidth="3" />
      <g fill="#F5C451" stroke="none" opacity="0.9">
        <circle cx="54" cy="140" r="3" />
        <circle cx="146" cy="140" r="3" />
      </g>
    </g>
  );
}

/** A record: grooves and a gold label. */
function Record() {
  return (
    <g>
      <g fill="none" stroke="#fff" opacity="0.08">
        {[92, 82, 72, 62, 52, 42].map((r) => <circle key={r} cx="100" cy="100" r={r} strokeWidth="3" />)}
      </g>
      <circle cx="100" cy="100" r="28" fill="#E8C268" opacity="0.16" />
      <circle cx="100" cy="100" r="4" fill="#000" opacity="0.4" />
    </g>
  );
}

export function BannerMotif({ look }: { look: LeagueLook }) {
  if (look.theme !== 'studio') {
    return (
      <svg aria-hidden viewBox="0 0 200 200" className={MOTIF}>
        <MasterMark x={100} y={100} size={190} color="#fff" opacity={0.07} />
      </svg>
    );
  }
  return (
    <svg aria-hidden viewBox="0 0 200 200" className={MOTIF}>
      {look.id === 'offSeason' ? <DawnCourt /> : look.id === 'section80' ? <Cassette /> : <Record />}
    </svg>
  );
}

/** The season's emblem: the crest for football, the record for studio (its label in the group's colour). */
export function SeasonEmblem({ look, size, className, stars }: { look: LeagueLook; size: number; className?: string; stars?: boolean }) {
  if (look.theme !== 'studio') return <LeagueCrestSvg size={size} className={className} stars={stars} />;
  return <StudioEmblemSvg size={size} label={look.label} className={className} />;
}
