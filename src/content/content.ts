/* Your routes, rides and pins — the same rows the phone syncs
   (my_changes / delete_mine, docs/13-onx-features.md). */
import { PIN_KINDS } from '../lib/config';
import { bounds, dedupe, type LngLat } from '../lib/geo';
import { sb } from '../lib/supabase';
import { getMap, useApp, type PinRow, type RideRow, type RouteRow } from '../state/store';

export const routeLine = (legs: RouteRow['legs']): LngLat[] => dedupe((legs || []).flatMap((l) => l.points || []).map((p) => [p[0], p[1]]));
export const rideLine = (track: number[][] | null): LngLat[] => dedupe((track || []).map((p) => [p[0], p[1]]));

export const keyOf = (type: 'route' | 'ride' | 'pin', clientId: string) => `${type}:${clientId}`;

export async function refreshContent() {
  const { data, error } = await sb.rpc('my_changes', { p_since: '1970-01-01T00:00:00Z' });
  if (error) { useApp.getState().showToast('Couldn’t load your things: ' + error.message); return; }
  const d = data as { routes: RouteRow[]; activities: RideRow[]; waypoints: PinRow[] };
  const live = <T extends { deleted: boolean }>(rows: T[] | null) => (rows || []).filter((r) => !r.deleted);
  useApp.getState().setContent({ routes: live(d.routes), rides: live(d.activities), pins: live(d.waypoints) });
  drawMine();
}

/** Draw everything that isn't hidden on the map. */
export function drawMine() {
  const map = getMap(); if (!map || !map.getSource('mine-lines')) return;
  const { routes, rides, pins, hidden } = useApp.getState();
  const lines: GeoJSON.Feature[] = [];
  for (const r of routes) if (!hidden.has(keyOf('route', r.client_id))) {
    const c = routeLine(r.legs); if (c.length > 1) lines.push({ type: 'Feature', properties: { kind: 'route', client_id: r.client_id, title: r.name, color: '#C8662A' }, geometry: { type: 'LineString', coordinates: c } });
  }
  for (const a of rides) if (!hidden.has(keyOf('ride', a.client_id))) {
    const c = rideLine(a.track); if (c.length > 1) lines.push({ type: 'Feature', properties: { kind: 'ride', client_id: a.client_id, title: a.title || 'Ride', color: '#2F6E8A' }, geometry: { type: 'LineString', coordinates: c } });
  }
  (map.getSource('mine-lines') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: lines });
  (map.getSource('mine-pins') as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features: pins.filter((w) => !hidden.has(keyOf('pin', w.client_id))).map((w) => ({
    type: 'Feature', properties: { kind: 'pin', client_id: w.client_id, title: w.title, note: w.note, pinKind: w.kind, folder: w.folder, color: PIN_KINDS[w.kind]?.color || '#C8662A' },
    geometry: { type: 'Point', coordinates: [w.lon, w.lat] } })) });
}

export function focusLine(line: LngLat[]) {
  const map = getMap(); if (!map) return;
  (map.getSource('focus-line') as mapboxgl.GeoJSONSource)?.setData(line.length > 1
    ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }
    : { type: 'FeatureCollection', features: [] });
  if (line.length > 1) map.fitBounds(bounds(line), { padding: { top: 80, bottom: 80, left: 440, right: 120 }, duration: 900 });
}
export const clearFocus = () => focusLine([]);

export async function savePin(p: { title: string; kind: string; note?: string; lon: number; lat: number; folder?: string | null }) {
  const s = useApp.getState(); if (!s.session) return false;
  const { error } = await sb.from('waypoints').insert({
    user_id: s.session.user.id, client_id: crypto.randomUUID().toUpperCase(), kind: p.kind, title: p.title.slice(0, 120),
    note: p.note?.slice(0, 2000) || null, location: `SRID=4326;POINT(${p.lon} ${p.lat})`, folder: p.folder || null
  });
  if (error) { s.showToast('Couldn’t save the pin: ' + error.message); return false; }
  await refreshContent();
  return true;
}

export async function saveRoute(r: { name: string; legs: Array<{ mode: string; points: LngLat[] }>; distance_m: number; ascent_m: number; descent_m: number; folder?: string | null }) {
  const s = useApp.getState(); if (!s.session) return false;
  const { error } = await sb.from('routes').insert({
    user_id: s.session.user.id, client_id: crypto.randomUUID().toUpperCase(), name: r.name.slice(0, 120),
    distance_m: r.distance_m, ascent_m: r.ascent_m, descent_m: r.descent_m, legs: r.legs, folder: r.folder || null
  });
  if (error) { s.showToast('Couldn’t save the route: ' + error.message); return false; }
  await refreshContent();
  return true;
}

export async function saveTrack(name: string, points: LngLat[], folder?: string | null) {
  // Imported GPX/KML lines become rides (activities) with source 'gpx', like the phone's GPX import.
  const s = useApp.getState(); if (!s.session) return false;
  const now = new Date().toISOString();
  const wkt = 'SRID=4326;LINESTRING ZM(' + points.map((p) => `${p[0]} ${p[1]} 0 0`).join(',') + ')';
  const { error } = await sb.from('activities').insert({
    user_id: s.session.user.id, client_id: crypto.randomUUID().toUpperCase(), activity_type: s.activity === 'all' ? 'mtb' : s.activity,
    title: name.slice(0, 120), started_at: now, ended_at: now, source: 'gpx', track: wkt, folder: folder || null
  });
  if (error) { s.showToast('Couldn’t import ' + name + ': ' + error.message); return false; }
  return true;
}

const TABLE = { route: 'routes', ride: 'activities', pin: 'waypoints' } as const;

export async function deleteItem(type: 'route' | 'ride' | 'pin', clientId: string) {
  const { error } = await sb.rpc('delete_mine', { p_table: TABLE[type], p_client: clientId });
  if (error) { useApp.getState().showToast('Couldn’t delete: ' + error.message); return; }
  await refreshContent();
}

export async function moveToFolder(type: 'route' | 'ride' | 'pin', clientId: string, folder: string | null) {
  const s = useApp.getState(); if (!s.session) return;
  const { error } = await sb.from(TABLE[type]).update({ folder }).eq('user_id', s.session.user.id).eq('client_id', clientId);
  if (error) { s.showToast('Couldn’t move it: ' + error.message); return; }
  await refreshContent();
}

export async function renameItem(type: 'route' | 'ride' | 'pin', clientId: string, name: string) {
  const s = useApp.getState(); if (!s.session) return;
  const col = type === 'route' ? 'name' : 'title';
  const { error } = await sb.from(TABLE[type]).update({ [col]: name.slice(0, 120) }).eq('user_id', s.session.user.id).eq('client_id', clientId);
  if (error) { s.showToast('Couldn’t rename it: ' + error.message); return; }
  await refreshContent();
}

export function folders(): string[] {
  const { routes, rides, pins } = useApp.getState();
  return [...new Set([...routes, ...rides, ...pins].map((r) => r.folder).filter((f): f is string => !!f))].sort();
}
