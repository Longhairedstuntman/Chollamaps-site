import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { acres, feet, miles } from '../lib/format';
import { dedupe, dist, lineLength, polygonArea, type LngLat } from '../lib/geo';
import { download, gpxForLine } from '../lib/gpx';
import { PIN_KINDS } from '../lib/config';
import { savePin, saveRoute } from '../content/content';
import { getMap, useApp } from '../state/store';
import { I } from '../shell/Icons';
import { claimClicks } from './bus';
import { elevationGain, routeLeg, type Leg } from './router';

const src = (id: string) => getMap()?.getSource(id) as mapboxgl.GeoJSONSource | undefined;
const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });
const clearScratch = () => { for (const id of ['tool-line', 'tool-fill', 'tool-points']) src(id)?.setData(fc([])); };

/** The floating card for the active tool: Pin, Measure, Area or Plan route. */
export default function ToolPanel() {
  const tool = useApp((s) => s.tool);
  if (!tool) return null;
  return <section className="toolcard">{tool === 'pin' ? <PinTool /> : tool === 'route' ? <RouteTool /> : <MeasureTool area={tool === 'area'} />}</section>;
}

function Close() {
  const setTool = useApp((s) => s.setTool);
  return <button type="button" className="icon-btn close" onClick={() => setTool(null)} aria-label="Close">{I.close()}</button>;
}

// ---------------------------------------------------------------- Pin: appears at the map center, drag it where it goes

function PinTool() {
  const setTool = useApp((s) => s.setTool), toast = useApp((s) => s.showToast);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [title, setTitle] = useState(''), [kind, setKind] = useState('pin'), [note, setNote] = useState('');
  useEffect(() => {
    const map = getMap(); if (!map) return;
    const m = new mapboxgl.Marker({ color: PIN_KINDS[kind]?.color || '#C8662A', draggable: true }).setLngLat(map.getCenter()).addTo(map);
    marker.current = m;
    claimClicks((e) => { m.setLngLat(e.lngLat); return true; });   // a click moves it too
    return () => { m.remove(); claimClicks(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { const el = marker.current?.getElement().querySelector('svg path'); if (el) el.setAttribute('fill', PIN_KINDS[kind]?.color || '#C8662A'); }, [kind]);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const ll = marker.current?.getLngLat(); if (!ll) return;
      if (await savePin({ title: title || 'Pin', kind, note, lon: ll.lng, lat: ll.lat })) { toast('Pinned. It’ll be on your phone after the next sync.'); setTool(null); }
    }}>
      <Close />
      <div className="eyebrow">New pin</div>
      <p className="fine">Drag the pin to the spot, or click the map to move it.</p>
      <input className="input" placeholder="Name" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus />
      <div className="chips">{Object.entries(PIN_KINDS).map(([k, v]) => <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}><i className="sw dot" style={{ background: v.color }} />{v.label}</button>)}</div>
      <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      <div className="actions"><button type="submit" className="btn primary">Save pin</button><button type="button" className="btn" onClick={() => setTool(null)}>Cancel</button></div>
    </form>
  );
}

// ---------------------------------------------------------------- Measure distance / area

function MeasureTool({ area }: { area: boolean }) {
  const [pts, setPts] = useState<LngLat[]>([]);
  const session = useApp((s) => s.session), toast = useApp((s) => s.showToast), setTool = useApp((s) => s.setTool);
  useEffect(() => {
    claimClicks((e) => { setPts((p) => [...p, [e.lngLat.lng, e.lngLat.lat]]); return true; });
    return () => { claimClicks(null); clearScratch(); };
  }, []);
  useEffect(() => {
    src('tool-points')?.setData(fc(pts.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }))));
    src('tool-line')?.setData(fc(pts.length > 1 ? [{ type: 'Feature', properties: { mode: 'blaze' }, geometry: { type: 'LineString', coordinates: area && pts.length > 2 ? [...pts, pts[0]] : pts } }] : []));
    src('tool-fill')?.setData(fc(area && pts.length > 2 ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] } }] : []));
  }, [pts, area]);
  const total = lineLength(pts), perim = pts.length > 2 ? total + dist(pts[pts.length - 1], pts[0]) : total;
  const map = getMap(), e = map && pts.length > 1 ? elevationGain(map, pts) : null;
  return (
    <div>
      <Close />
      <div className="eyebrow">{area ? 'Measure area' : 'Measure distance'}</div>
      <p className="fine">{area ? 'Click three or more corners.' : 'Click the map; each click adds a leg.'}</p>
      <div className="stats">
        {area ? <>
          <div><small>AREA</small><b>{pts.length > 2 ? acres(polygonArea(pts)) : '—'}</b></div>
          <div><small>PERIMETER</small><b>{pts.length > 2 ? miles(perim) : '—'}</b></div>
          <div><small>CORNERS</small><b>{pts.length}</b></div>
        </> : <>
          <div><small>DISTANCE</small><b>{pts.length > 1 ? miles(total) : '—'}</b></div>
          <div><small>ASCENT</small><b>{e ? '↑ ' + feet(e.up) : '—'}</b></div>
          <div><small>DESCENT</small><b>{e ? '↓ ' + feet(e.down) : '—'}</b></div>
        </>}
      </div>
      {!area && pts.length > 1 && <ol className="legs">{pts.slice(1).map((p, i) => <li key={i}>{miles(dist(pts[i], p))}</li>)}</ol>}
      <div className="actions">
        <button type="button" className="btn" disabled={!pts.length} onClick={() => setPts((p) => p.slice(0, -1))}>{I.undo({ width: 14, height: 14 })} Undo</button>
        <button type="button" className="btn" disabled={!pts.length} onClick={() => setPts([])}>Clear</button>
        {!area && <button type="button" className="btn" disabled={pts.length < 2} onClick={() => download('Measured line.gpx', gpxForLine('Measured line', pts))}>GPX</button>}
        {!area && <button type="button" className="btn primary" disabled={pts.length < 2} onClick={async () => {
          if (!session) return toast('Sign in to save.');
          const name = prompt('Save as a route named', 'Line ' + new Date().toLocaleDateString()); if (!name) return;
          if (await saveRoute({ name, legs: [{ mode: 'blaze', points: pts }], distance_m: total, ascent_m: e?.up ?? 0, descent_m: e?.down ?? 0 })) { toast('Saved to My Cholla.'); setTool(null); }
        }}>Save as route</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Plan a route: Snap to trails / Trail Blazer / Undo / Save

function Profile({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 320, h = 54, min = Math.min(...values), max = Math.max(...values), span = Math.max(1, max - min);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 8) - 4}`).join(' ');
  return (
    <svg className="profile" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label="Elevation profile">
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill="rgba(200,102,42,.18)" stroke="none" />
      <polyline points={pts} fill="none" stroke="#C8662A" strokeWidth="2" />
      <text x="2" y="10" fontSize="9" fill="#5E6B62">{feet(max)}</text><text x="2" y={h - 2} fontSize="9" fill="#5E6B62">{feet(min)}</text>
    </svg>
  );
}

function RouteTool() {
  const activity = useApp((s) => s.activity), session = useApp((s) => s.session), toast = useApp((s) => s.showToast), setTool = useApp((s) => s.setTool);
  const seed = useApp((s) => s.routeSeed);
  const [mode, setMode] = useState<'follow' | 'blaze'>('follow');
  const [stops, setStops] = useState<LngLat[]>(seed ? [seed] : []);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [busy, setBusy] = useState(false);
  const modeRef = useRef(mode); modeRef.current = mode;
  const stopsRef = useRef(stops); stopsRef.current = stops;
  const profile = activity === 'moto' || activity === 'snowmobile' ? 'driving' : activity === 'hike' || activity === 'ski' ? 'walking' : 'cycling';

  const leg = async (a: LngLat, b: LngLat, m: 'follow' | 'blaze'): Promise<Leg> => {
    if (m === 'blaze') return { mode: 'blaze', points: [a, b], via: 'Straight line' };
    const map = getMap()!; setBusy(true);
    try { return await routeLeg(map, a, b, profile, toast); } finally { setBusy(false); }
  };
  useEffect(() => {
    useApp.setState({ routeSeed: null });
    claimClicks((e) => {
      const p: LngLat = [e.lngLat.lng, e.lngLat.lat];
      const prev = stopsRef.current[stopsRef.current.length - 1];
      setStops((s) => [...s, p]);
      if (prev) {
        const m = modeRef.current;
        setLegs((l) => [...l, { mode: m, points: [prev, p], via: m === 'blaze' ? 'Straight line' : 'Finding a way…' }]);
        void leg(prev, p, m).then((done) => setLegs((l) => l.map((x, i) => (i === l.length - 1 && x.points[1] === p ? done : x))));
      }
      return true;
    });
    return () => { claimClicks(null); clearScratch(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    src('tool-line')?.setData(fc(legs.map((l) => ({ type: 'Feature', properties: { mode: l.mode }, geometry: { type: 'LineString', coordinates: l.points } }))));
    src('tool-points')?.setData(fc(stops.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }))));
  }, [legs, stops]);

  const line = dedupe(legs.flatMap((l) => l.points));
  const map = getMap(), e = map && line.length > 1 ? elevationGain(map, line) : null;
  const flip = async (i: number) => {
    const l = legs[i], a = stops[i], b = stops[i + 1];
    const done = await leg(a, b, l.mode === 'follow' ? 'blaze' : 'follow');
    setLegs((ls) => ls.map((x, j) => (j === i ? done : x)));
  };
  return (
    <div>
      <Close />
      <div className="eyebrow">Plan a route</div>
      <div className="seg">
        <button type="button" aria-pressed={mode === 'follow'} onClick={() => setMode('follow')}>Snap to trails</button>
        <button type="button" aria-pressed={mode === 'blaze'} onClick={() => setMode('blaze')}>Trail Blazer</button>
      </div>
      <p className="fine">{busy ? 'Finding a way…' : mode === 'follow' ? 'Click the map. Each leg follows trails and roads — zoom in so the trails around you are loaded.' : 'Each leg goes straight point to point: off trail, washes, new lines.'}</p>
      {line.length > 1 && <div className="stats">
        <div><small>DISTANCE</small><b>{miles(lineLength(line))}</b></div>
        <div><small>ASCENT</small><b>{e ? '↑ ' + feet(e.up) : '—'}</b></div>
        <div><small>DESCENT</small><b>{e ? '↓ ' + feet(e.down) : '—'}</b></div>
      </div>}
      {e && <Profile values={e.profile} />}
      {legs.length > 0 && <ol className="legs">{legs.map((l, i) => <li key={i}>{miles(lineLength(l.points))} · {l.via} <button type="button" className="link" onClick={() => flip(i)}>{l.mode === 'follow' ? 'Blaze it' : 'Follow trails'}</button></li>)}</ol>}
      <div className="actions">
        <button type="button" className="btn" disabled={!stops.length} onClick={() => { setStops((s) => s.slice(0, -1)); setLegs((l) => l.slice(0, -1)); }}>{I.undo({ width: 14, height: 14 })} Undo</button>
        <button type="button" className="btn" disabled={!stops.length} onClick={() => { setStops([]); setLegs([]); }}>Clear</button>
        <button type="button" className="btn" disabled={line.length < 2} onClick={() => download('Cholla route.gpx', gpxForLine('Cholla route', line))}>GPX</button>
        <button type="button" className="btn primary" disabled={line.length < 2 || busy} onClick={async () => {
          if (!session) return toast('Sign in to save routes.');
          const name = prompt('Name this route', 'Route ' + new Date().toLocaleDateString()); if (!name) return;
          if (await saveRoute({ name, legs: legs.map((l) => ({ mode: l.mode, points: l.points })), distance_m: lineLength(line), ascent_m: e?.up ?? 0, descent_m: e?.down ?? 0 })) {
            toast('Saved. It’ll be on your phone after the next sync.'); setTool(null);
          }
        }}>Save</button>
      </div>
    </div>
  );
}
