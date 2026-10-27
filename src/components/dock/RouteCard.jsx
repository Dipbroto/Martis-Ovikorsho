import { Route as RouteIcon } from 'lucide-react';
import useMapStore from '../../store/useMapStore';
import DockCard from './DockCard';
import RouteBuilder from './RouteBuilder';
import WalkPanel from './WalkPanel';

/** The one card for routes: the builder until there is a route, then the walk panel. */
export default function RouteCard() {
  const hasRoute = useMapStore((s) => s.waypoints.length > 1);
  const editing = useMapStore((s) => s.routeEditing);
  const routePlanOpen = useMapStore((s) => s.routePlanOpen);
  const setRoutePlanOpen = useMapStore((s) => s.setRoutePlanOpen);

  if (hasRoute && !editing) return <WalkPanel />;

  // Only appear when explicitly opened (e.g. clicked "Plan a walk" from the left sidebar or toolbar)
  if (!routePlanOpen) return null;

  return (
    <DockCard
      id="route-plan"
      title="Plan a walk"
      subtitle="From one point to another, on real NASA terrain"
      icon={RouteIcon}
      accent="#F26A3D"
      onClose={() => setRoutePlanOpen(false)}
    >
      <RouteBuilder />
    </DockCard>
  );
}
