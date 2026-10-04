/** Props, one per PROPS entry. `front` sits under the resting right fin; `over` covers it too. */
import type { ReactNode } from 'react';
import { book, calculator, coffee, laptop, pencil, pillow, quill } from './propsStudy';
import { controller, cupcake, decks, guitar, magnifier, rocket, trophy, wave } from './propsFun';

export interface PropPiece {
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
];
