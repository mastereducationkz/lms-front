/** One orca avatar: background → back of outfit → orca → face → eyewear → hat → prop → fin. */
import { useId } from 'react';
import { BACKGROUND_ART } from './art/backgrounds';
import { Blush, OrcaBody, OrcaDefs, OrcaFinRight } from './art/base';
import { EXPRESSION_ART } from './art/expressions';
import { EYEWEAR_ART } from './art/eyewear';
import { HAT_ART } from './art/hats';
import { PROP_ART } from './art/props';
import { CATEGORY_PARTS, type MascotConfig } from './config';

interface OrcaProps {
  config: MascotConfig;
  size?: number;
  className?: string;
  title?: string;
  /** Fixed id prefix — only for static rendering of many orcas into one document. */
  idPrefix?: string;
}

export default function Orca({ config, size = 40, className, title, idPrefix }: OrcaProps) {
  const reactId = useId();
  const uid = idPrefix ?? `o${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const hat = HAT_ART[config.hat] ?? {};
  const prop = PROP_ART[config.prop] ?? {};
  const label = title ?? `Orca: ${CATEGORY_PARTS.hat[config.hat]?.label ?? ''}`;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role="img" aria-label={label}>
      <defs>
        <clipPath id={`${uid}circle`}>
          <circle cx="100" cy="100" r="100" />
        </clipPath>
        <OrcaDefs uid={uid} />
      </defs>
      <g clipPath={`url(#${uid}circle)`}>
        {BACKGROUND_ART[config.background]?.(uid)}
        {hat.back?.(uid)}
        <OrcaBody uid={uid} dorsal={!hat.noDorsal} />
        <Blush />
        {EXPRESSION_ART[config.expression]?.(uid)}
        {EYEWEAR_ART[config.eyewear]?.(uid)}
        {hat.front?.(uid)}
        {prop.front?.(uid)}
        <OrcaFinRight uid={uid} />
        {prop.over?.(uid)}
      </g>
    </svg>
  );
}
