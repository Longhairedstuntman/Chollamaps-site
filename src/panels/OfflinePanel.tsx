import { useApp } from '../state/store';
import Panel from './Panel';

/** Offline maps are downloaded on the phone (onX: device-only too). The web shows what the plan is. */
export default function OfflinePanel({ onClose }: { onClose: () => void }) {
  const pro = useApp((s) => s.pro);
  return (
    <Panel title="Offline maps" onClose={onClose}>
      <p>Offline areas are saved to your phone, where you’ll use them. In the Cholla app: <b>Layers → Offline → Download what’s on screen</b>. A saved area carries the base map, 3D terrain, trails, vehicle routes and land for that screen, plus the trail data for routing and trail pages.</p>
      <p className="fine">Live layers (radar, fires, avalanche, snow, slope) always need a signal and aren’t part of a download.</p>
      {!pro && <p className="fine">Offline maps are part of <b>Cholla Pro</b> — subscribe in the app, and it’s on here too.</p>}
      <p className="fine">Planning an area here and downloading it on the phone is on the build board.</p>
    </Panel>
  );
}
