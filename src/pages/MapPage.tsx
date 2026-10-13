import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import MapCanvas from '../map/MapCanvas';
import Rail from '../shell/Rail';
import TopBar from '../shell/TopBar';
import Tools from '../shell/Tools';
import Corner from '../shell/Corner';
import LayersPanel from '../panels/LayersPanel';
import MyChollaPanel from '../panels/MyChollaPanel';
import ExplorePanel from '../panels/ExplorePanel';
import OfflinePanel from '../panels/OfflinePanel';
import AccountPanel from '../panels/AccountPanel';
import SearchPanel from '../panels/SearchPanel';
import WeatherCard from '../panels/WeatherCard';
import InfoCard from '../panels/InfoCard';
import ToolPanel from '../tools/ToolPanel';
import { getMap, useApp } from '../state/store';
import { parseCoords } from '../lib/geo';

/** The web map. Sign-in required, like onX's web map. */
export default function MapPage() {
  const session = useApp((s) => s.session), authReady = useApp((s) => s.authReady);
  const panel = useApp((s) => s.panel), setPanel = useApp((s) => s.setPanel), setTool = useApp((s) => s.setTool), setInfo = useApp((s) => s.setInfo);
  const toast = useApp((s) => s.toast), weatherAt = useApp((s) => s.weatherAt);
  const location = useLocation();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useApp.getState();
      if (s.tool) setTool(null); else if (s.info) setInfo(null); else if (s.panel) setPanel(s.panel);
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [setPanel, setTool, setInfo]);

  // ?at=lon,lat opens the spot card — that's what a shared link carries.
  useEffect(() => {
    const at = new URLSearchParams(location.search).get('at'); if (!at) return;
    const c = parseCoords(at.split(',').reverse().join(',')); if (!c) return;
    const t = setTimeout(() => { setInfo({ kind: 'spot', props: {}, lngLat: c }); getMap()?.flyTo({ center: c, zoom: Math.max(getMap()?.getZoom() || 0, 13) }); }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authReady) return <div className="splash"><img src="/brand/cholla-mark-192.png" alt="" width="40" /><p>Loading Cholla…</p></div>;
  if (!session) return <Navigate to={'/sign-in?next=' + encodeURIComponent(location.pathname + location.search)} replace />;

  const close = () => setPanel(panel);
  return (
    <div className="app">
      <MapCanvas />
      <Rail />
      <TopBar />
      <Tools />
      <Corner />
      {panel === 'search' && <SearchPanel onClose={close} />}
      {panel === 'mine' && <MyChollaPanel onClose={close} />}
      {panel === 'explore' && <ExplorePanel onClose={close} />}
      {panel === 'offline' && <OfflinePanel onClose={close} />}
      {panel === 'layers' && <LayersPanel onClose={close} />}
      {panel === 'account' && <AccountPanel onClose={close} />}
      {panel === 'weather' && <WeatherCard onClose={close} at={weatherAt || undefined} />}
      <InfoCard />
      <ToolPanel />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
