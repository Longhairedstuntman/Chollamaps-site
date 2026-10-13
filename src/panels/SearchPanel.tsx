import { useEffect, useRef, useState } from 'react';
import { AREAS, MAPBOX_TOKEN } from '../lib/config';
import { parseCoords } from '../lib/geo';
import { getMap, useApp } from '../state/store';
import Panel from './Panel';

interface Hit { name: string; sub: string; lngLat: [number, number]; bbox?: [number, number, number, number]; kind: 'place' | 'coords' | 'area' | 'trail' }

/** Search — places and addresses (Mapbox), coordinates, Cholla areas, and trail names in the loaded tiles. */
export default function SearchPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const setInfo = useApp((s) => s.setInfo), tilted = useApp((s) => s.tilted);
  useEffect(() => { input.current?.focus(); }, []);

  useEffect(() => {
    const text = q.trim();
    if (!text) { setHits([]); return; }
    const out: Hit[] = [];
    const c = parseCoords(text);
    if (c) out.push({ name: `${c[1].toFixed(5)}, ${c[0].toFixed(5)}`, sub: 'Coordinates', lngLat: c, kind: 'coords' });
    for (const [name, b] of AREAS) if (name.toLowerCase().includes(text.toLowerCase())) out.push({ name, sub: 'Cholla area', lngLat: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2], bbox: b, kind: 'area' });
    const map = getMap();
    if (map?.getLayer('trails')) {
      const seen = new Set<string>();
      for (const sl of ['trails', 'mvum']) for (const f of map.querySourceFeatures('lines', { sourceLayer: sl })) {
        const name = String(f.properties?.name || ''); if (!name || !name.toLowerCase().includes(text.toLowerCase()) || seen.has(name)) continue;
        seen.add(name);
        const g = f.geometry; const p = g.type === 'LineString' ? g.coordinates[0] : g.type === 'MultiLineString' ? g.coordinates[0][0] : null;
        if (p) out.push({ name, sub: sl === 'trails' ? 'Trail' : 'Forest Service route', lngLat: [p[0], p[1]], kind: 'trail' });
        if (seen.size > 8) break;
      }
    }
    setHits(out); setActive(0);
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      const center = map?.getCenter();
      const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(text)}&country=US&limit=6&types=place,locality,neighborhood,address,poi,street&language=en` +
        (center ? `&proximity=${center.lng},${center.lat}` : '') + `&access_token=${MAPBOX_TOKEN}`;
      try {
        const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) return;
        const j = await r.json();
        const places: Hit[] = (j.features || []).map((f: { properties: { name: string; place_formatted?: string; bbox?: number[] }; geometry: { coordinates: [number, number] } }) => ({
          name: f.properties.name, sub: f.properties.place_formatted || 'Place', lngLat: f.geometry.coordinates, bbox: f.properties.bbox as Hit['bbox'], kind: 'place' as const }));
        setHits((h) => [...h.filter((x) => x.kind !== 'place'), ...places]);
      } catch { /* aborted or offline */ }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const go = (h: Hit) => {
    const map = getMap(); if (!map) return;
    if (h.bbox) map.fitBounds([[h.bbox[0], h.bbox[1]], [h.bbox[2], h.bbox[3]]], { padding: { top: 60, bottom: 60, left: 440, right: 120 }, pitch: tilted ? 55 : 0 });
    else map.flyTo({ center: h.lngLat, zoom: h.kind === 'trail' ? 14 : h.kind === 'coords' ? 14 : 12 });
    if (h.kind === 'coords') setInfo({ kind: 'spot', props: {}, lngLat: h.lngLat });
    onClose();
  };

  return (
    <Panel title="Search" onClose={onClose}>
      <input ref={input} className="input big" placeholder="Trail, town, address, or 38.5733, -109.5498" value={q} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && hits[active]) go(hits[active]);
        }} />
      <div className="list">
        {hits.map((h, i) => (
          <button key={h.kind + h.name + i} type="button" className={'item item-main' + (i === active ? ' active' : '')} onMouseEnter={() => setActive(i)} onClick={() => go(h)}>
            <strong>{h.name}</strong><small>{h.sub}</small>
          </button>
        ))}
      </div>
      {!q && <p className="fine">Trail names search what’s loaded on the map around you — zoom to the area first. Places and addresses search everywhere.</p>}
    </Panel>
  );
}
