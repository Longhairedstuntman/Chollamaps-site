import mapboxgl from 'mapbox-gl';
import { BASES } from '../lib/config';
import { getMap, useApp } from '../state/store';
import { I } from './Icons';

let me: mapboxgl.Marker | null = null;

/** Bottom-right: Layers, 3D, Locate, Weather — where onX keeps Basemaps/Layers, 2D/3D and Location. */
export default function Corner() {
  const base = useApp((s) => s.base), panel = useApp((s) => s.panel), setPanel = useApp((s) => s.setPanel);
  const tilted = useApp((s) => s.tilted), setTilted = useApp((s) => s.setTilted), pro = useApp((s) => s.pro), toast = useApp((s) => s.showToast);
  const locate = () => {
    const map = getMap(); if (!map || !navigator.geolocation) return toast('This browser can’t share its location.');
    navigator.geolocation.getCurrentPosition((pos) => {
      const c: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      map.flyTo({ center: c, zoom: Math.max(map.getZoom(), 13) });
      if (!me) me = new mapboxgl.Marker({ color: '#2F6E8A' });
      me.setLngLat(c).addTo(map);
    }, () => toast('Location is blocked for this page.'));
  };
  const toggle3d = () => {
    if (!pro && !tilted) { setPanel('account'); toast('3D terrain is a Cholla Pro feature.'); return; }
    setTilted(!tilted);
  };
  return (
    <div className="corner">
      <button type="button" className="corner-btn" aria-pressed={panel === 'weather'} onClick={() => setPanel('weather')} title="Weather here">{I.weather()}</button>
      <button type="button" className="corner-btn" onClick={locate} title="My location">{I.locate()}</button>
      <button type="button" className="corner-btn" aria-pressed={tilted} onClick={toggle3d} title={tilted ? 'Back to 2D' : '3D terrain (Pro)'}>{I.cube()}<small>{tilted ? '3D' : '2D'}</small></button>
      <button type="button" className="corner-btn layers" aria-pressed={panel === 'layers'} onClick={() => setPanel('layers')} title="Layers">{I.layers()}<small>{BASES[base].label}</small></button>
    </div>
  );
}
