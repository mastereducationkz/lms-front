/** Props, one per PROPS entry. `front` sits under the resting right fin; `over` covers it too. */
import type { ReactNode } from 'react';
import { book, calculator, coffee, laptop, pencil, pillow, quill } from './propsStudy';
import { controller, cupcake, decks, guitar, magnifier, rocket, trophy, wave } from './propsFun';
import { REWARD_PROPS } from './rewardProps';

export interface PropPiece {
  /** Behind the orca (e.g. a jetpack on its back). */
  back?: (uid: string) => ReactNode;
  front?: (uid: string) => ReactNode;
  over?: (uid: string) => ReactNode;
}

export const PROP_ART: PropPiece[] = [
  {},
  laptop,
  book,
  coffee,
  pillow,
  calculator,
  quill,
  rocket,
  guitar,
  controller,
  magnifier,
  decks,
  wave,
  pencil,
  trophy,
  cupcake,
  // rewards, appended in contract order (swim ring … lightning badge)
  ...REWARD_PROPS,
];
