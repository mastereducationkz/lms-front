/**
 * Everything Halloween draws, behind one lazily loaded chunk: nobody downloads it outside the
 * season, and a person who switched decorations off never does either.
 */
import '@/lib/i18n/catalogs/seasonal';
import './halloween.css';
import type { SlotProps } from '../SeasonSlot';
import AvatarCostume from './AvatarCostume';
import Finale from './Finale';
import Greeting from './Greeting';
import HiddenPumpkin from './HiddenPumpkin';
import TrickOrTreat from './TrickOrTreat';

export default function HalloweenSlot(props: SlotProps) {
  switch (props.name) {
    case 'topbar':
      return <TrickOrTreat className="hidden h-10 w-10 sm:flex" />;
    case 'greeting':
      return <Greeting />;
    case 'avatar':
      return <AvatarCostume size={props.size} seed={props.seed} />;
    case 'overlay':
      return (
        <>
          <HiddenPumpkin />
          <Finale />
        </>
      );
  }
}
