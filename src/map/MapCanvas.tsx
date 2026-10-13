import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { BASES, MAPBOX_TOKEN } from '../lib/config';
import { formatPrefs, formatView, initialView, parsePrefs, parseView, rememberView } from '../lib/url';
import { getMap, setMap, useApp } from '../state/store';
import { addAll, applyView, setLive, TAPPABLE } from './overlays';
import { LAYERS, type LayerId } from './layers';
import { dispatchClick } from '../tools/bus';
import { drawMine, refreshContent } from '../content/content';

mapboxgl.accessToken = MAPBOX_TOKEN;
const LIVE_IDS = LAYERS.filter((l) => l.id !== 'trails' && l.id !== 'mvum' && l.id !== 'land' && !l.soon).map((l) => l.id);

export default function MapCanvas() {
  const box = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { view } = useParams();
  const location = useLocation();
  const base = useApp((s) => s.base), activity = useApp((s) => s.activity), layers = useApp((s) => s.layers), tilted = useApp((s) => s.tilted);
  const signedIn = useApp((s) => !!s.session);
  const applied = useRef(new Set<LayerId>());
  const ready = useRef(false);

  // Build the map once.
  useEffect(() => {
    if (!box.current || getMap()) return;
    const prefs = parsePrefs(location.search);
    if (prefs.base) useApp.getState().setBase(prefs.base);
    if (prefs.activity) useApp.getState().setActivity(prefs.activity);
    if (prefs.layers) useApp.getState().setLayers(prefs.layers as LayerId[]);
    const v = parseView(view) ?? initialView();
    const st = useApp.getState();
    const map = new mapboxgl.Map({
      container: box.current, style: BASES[st.base].url,
      center: [v.lon, v.lat], zoom: v.zoom, pitch: v.pitch ?? (st.tilted ? 55 : 0), bearing: v.bearing ?? 0,
      maxPitch: 80, attributionControl: false, logoPosition: 'bottom-left'
    });
    setMap(map);
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new mapboxgl.ScaleControl({ unit: st.profile?.units === 'metric' ? 'metric' : 'imperial' }), 'bottom-right');
    map.dragRotate.enable(); map.touchZoomRotate.enableRotation();

    const spec = () => { const s = useApp.getState(); return { base: s.base, activity: s.activity, layers: s.layers, signedIn: !!s.session }; };
    map.on('style.load', () => {
      ready.current = true;
      if (!map.getSource('mapbox-dem')) map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
      if (!map.getTerrain()) map.setTerrain({ source: 'mapbox-dem', exaggeration: 1 });
      addAll(map, spec());
      applied.current = new Set();
      const s = spec();
      for (const id of LIVE_IDS) if (s.layers.has(id)) { applied.current.add(id); void setLive(map, id, true, s.signedIn, s.base === 'night'); }
      drawMine();
    });
    map.on('error', (e) => {
      const msg = e?.error?.message || '';
      if (/401|403|Unauthorized|Forbidden/.test(msg)) useApp.getState().showToast('The map token doesn’t allow this address yet. Add it to the Mapbox token’s allowed URLs.');
    });

    let urlTimer = 0;
    map.on('moveend', () => {
      const c = map.getCenter();
      const vs = { lat: c.lat, lon: c.lng, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
      rememberView(vs);
      clearTimeout(urlTimer);
      urlTimer = window.setTimeout(() => {
        const s = useApp.getState();
        navigate(`/map/${formatView(vs)}${formatPrefs(s.base, s.activity, [...s.layers])}`, { replace: true });
      }, 150);
    });

    map.on('click', (e) => {
      if (dispatchClick(e)) return;
      const pad = 6, b: [mapboxgl.PointLike, mapboxgl.PointLike] = [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]];
      for (const [id, kind] of TAPPABLE) {
        if (!map.getLayer(id) || map.getLayoutProperty(id, 'visibility') === 'none') continue;
        const f = map.queryRenderedFeatures(b, { layers: [id] });
        if (f.length) { useApp.getState().setInfo({ kind, props: f[0].properties || {}, lngLat: [e.lngLat.lng, e.lngLat.lat] }); return; }
      }
      // Anywhere else: a spot card, like onX — coordinates, land, and the things you can do here.
      const land = map.getLayer('land-fill') ? map.queryRenderedFeatures(e.point, { layers: ['land-fill'] })[0]?.properties : undefined;
      useApp.getState().setInfo({ kind: 'spot', props: { land: land?.agency, unit: land?.unit }, lngLat: [e.lngLat.lng, e.lngLat.lat] });
    });
    map.on('mousemove', (e) => {
      const ids = TAPPABLE.map((t) => t[0]).filter((id) => id !== 'land-fill' && map.getLayer(id));
      const hit = ids.length && map.queryRenderedFeatures(e.point, { layers: ids }).length;
      map.getCanvas().style.cursor = useApp.getState().tool ? 'crosshair' : hit ? 'pointer' : '';
    });
    return () => { map.remove(); setMap(null); ready.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base map switch.
  const currentBase = useRef(base);
  useEffect(() => {
    const map = getMap(); if (!map || currentBase.current === base) return;
    currentBase.current = base;
    ready.current = false;
    map.setStyle(BASES[base].url, { diff: false } as unknown as Parameters<mapboxgl.Map['setStyle']>[1]);   // overlays come back on style.load
  }, [base]);

  // Activity / core layer changes.
  useEffect(() => {
    const map = getMap(); if (!map || !ready.current) return;
    applyView(map, { base, activity, layers, signedIn });
    for (const id of LIVE_IDS) {
      const want = layers.has(id), have = applied.current.has(id);
      if (want && !have) { applied.current.add(id); void setLive(map, id, true, signedIn, base === 'night'); }
      if (!want && have) { applied.current.delete(id); void setLive(map, id, false, signedIn); }
    }
    const s = useApp.getState();
    const c = map.getCenter();
    navigate(`/map/${formatView({ lat: c.lat, lon: c.lng, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() })}${formatPrefs(s.base, s.activity, [...s.layers])}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, layers, base]);

  // Conditions glow and your content need an account.
  useEffect(() => {
    const map = getMap(); if (!map) return;
    if (signedIn) { void refreshContent(); if (layers.has('conditions') && ready.current) void setLive(map, 'conditions', true, true); }
    else { drawMine(); if (ready.current) void setLive(map, 'conditions', false, false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // 3D.
  useEffect(() => {
    const map = getMap(); if (!map) return;
    map.easeTo({ pitch: tilted ? 55 : 0, bearing: tilted ? map.getBearing() : 0, duration: 700 });
  }, [tilted]);

  // Scale units follow the profile.
  const units = useApp((s) => s.profile?.units);
  useEffect(() => {
    const map = getMap(); if (!map) return;
    const ctl = (map as unknown as { _controls: unknown[] })._controls.find((c) => c instanceof mapboxgl.ScaleControl) as mapboxgl.ScaleControl | undefined;
    ctl?.setUnit(units === 'metric' ? 'metric' : 'imperial');
  }, [units]);

  return <div ref={box} className="map" aria-label="Map of trails, routes and land" />;
}
