import { AnimatePresence } from 'framer-motion';
import useMapStore from '../../store/useMapStore';
import PlaceCard from './PlaceCard';
import RouteCard from './RouteCard';
import RulerCard from './RulerCard';
import { ContingencyAlert } from '../ContingencySimulator';
import { TerrainOverlayPanel } from '../TerrainOverlay';
import { ResourcePanel } from '../ResourceOverlays';
import { RouteScanPanel } from '../RouteScan';
import QuakePanel from '../quakes/QuakePanel';
import MapWelcome from '../MapWelcome';

/**
 * Everything the map shows beside the map lives in this one column, so cards stack instead of
 * landing on top of each other. On a phone it becomes a sheet above the bottom bar.
 * Each card can be folded to its title with the chevron, and cards that were opened by a tap
 * (a place, the ruler) close with the X.
 */
export default function MapDock() {
  // The marsquake explorer is a mode of its own: while it is on, its panel is the only one beside the map
  const quakes = useMapStore((s) => s.quakeMode);
  const sidebarOpen = useMapStore((s) => s.sidebarOpen);
  const quakeFolded = useMapStore((s) => !!s.dockMin.quake);
  const split = useMapStore((s) => s.viewMode === 'split');
  return (
    <div className={`absolute z-[430] left-3 right-3 bottom-[92px] max-h-[44vh] sm:top-[140px] sm:bottom-[112px] sm:max-h-none ${quakes && quakeFolded ? 'sm:w-[270px]' : split ? 'sm:w-[320px]' : 'sm:w-[372px]'} pointer-events-none flex flex-col gap-3 overflow-y-auto overflow-x-hidden custom-scrollbar-y [&>*]:pointer-events-auto sm:pr-0.5 ${quakes ? (sidebarOpen ? 'sm:left-[404px]' : 'sm:left-[84px]') + ' sm:right-auto' : 'sm:left-auto sm:right-4'}`} aria-label="Map panels">
      <AnimatePresence initial={false}>
        <ContingencyAlert key="alert" />
      </AnimatePresence>
      {quakes ? (
        <>
          <QuakePanel />
          <RulerCard />
        </>
      ) : (
        <>
          <MapWelcome />
          <PlaceCard />
          <RouteCard />
          <RulerCard />
          <TerrainOverlayPanel />
          <ResourcePanel />
          <RouteScanPanel />
        </>
      )}
    </div>
  );
}
