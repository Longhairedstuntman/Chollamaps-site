/* Snap-to-trail routing, the same approach as the phone's RouteNetwork: a graph
   of the trail and MVUM lines in the loaded tiles, joined where vertices land
   within ~6 m, ends snapped to the nearest point on a line. Separate trail
   systems are joined with Mapbox road directions only for the gap. */
import { MAPBOX_TOKEN } from '../lib/config';
import { dist, type LngLat } from '../lib/geo';

interface Line { pts: LngLat[]; box: [number, number, number, number] }
export interface Leg { mode: 'follow' | 'blaze'; points: LngLat[]; via: string }

function network(map: mapboxgl.Map): Line[] {
  const lines: Line[] = [];
  for (const sl of ['trails', 'mvum']) {
    let feats: GeoJSON.Feature[] = [];
    try { feats = map.querySourceFeatures('lines', { sourceLayer: sl }) as GeoJSON.Feature[]; } catch { /* source not ready */ }
    for (const f of feats) {
      const g = f.geometry; if (!g) continue;
      const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const p of parts) if (p.length >= 2) {
        let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
        for (const q of p) { a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); }
        lines.push({ pts: p as LngLat[], box: [a, b, c, d] });
      }
    }
  }
  return lines;
}

type Solved = { pts: LngLat[] } | { head: LngLat[]; tail: LngLat[]; gap: [LngLat, LngLat] } | null;

function solve(net: Line[], a: LngLat, b: LngLat): Solved {
  const span = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])), pad = Math.max(0.03, span * 0.6);
  const box = [Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad];
  const near = net.filter((l) => l.box[2] >= box[0] && l.box[0] <= box[2] && l.box[3] >= box[1] && l.box[1] <= box[3]);
  const q = 0.00006, index = new Map<string, number>(), co: LngLat[] = [], adj: Array<Array<[number, number]>> = [], segs: Array<[number, number]> = [];
  const node = (p: LngLat) => {
    const k = Math.round(p[0] / q) + ':' + Math.round(p[1] / q);
    let i = index.get(k);
    if (i === undefined) { i = co.length; index.set(k, i); co.push(p); adj.push([]); }
    return i;
  };
  const link = (u: number, v: number) => { if (u === v) return; const w = dist(co[u], co[v]); adj[u].push([v, w]); adj[v].push([u, w]); };
  for (const l of near) { let prev = -1; for (const p of l.pts) { const n = node(p); if (prev >= 0 && prev !== n) { link(prev, n); segs.push([prev, n]); } prev = n; } }
  const nearest = (p: LngLat, max: number) => {
    const kx = 111320 * Math.cos(p[1] * Math.PI / 180), ky = 110540; let best: { u: number; v: number; at: LngLat } | null = null, bd = max;
    for (const [u, v] of segs) {
      const ax = (co[u][0] - p[0]) * kx, ay = (co[u][1] - p[1]) * ky, dx = (co[v][0] - co[u][0]) * kx, dy = (co[v][1] - co[u][1]) * ky;
      const L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < bd) { bd = d; best = { u, v, at: [co[u][0] + (co[v][0] - co[u][0]) * t, co[u][1] + (co[v][1] - co[u][1]) * t] }; }
    }
    return best;
  };
  const attach = (p: LngLat) => { const h = nearest(p, 400); if (!h) return -1; const i = co.length; co.push(h.at); adj.push([]); link(i, h.u); link(i, h.v); return i; };
  const s = attach(a), t = attach(b);
  if (s < 0 || t < 0) return null;
  const search = (src: number, target: number) => {
    const d = new Float64Array(co.length).fill(Infinity), prev = new Int32Array(co.length).fill(-1);
    d[src] = 0; const heap: Array<[number, number]> = [[0, src]];
    while (heap.length) {
      let mi = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[mi][0]) mi = i;
      const [du, u] = heap[mi]; heap[mi] = heap[heap.length - 1]; heap.pop();
      if (du > d[u]) continue; if (u === target) break;
      for (const [v, w] of adj[u]) if (du + w < d[v]) { d[v] = du + w; prev[v] = u; heap.push([d[v], v]); }
    }
    return { d, prev };
  };
  const path = (r: { prev: Int32Array }, end: number) => { const out: LngLat[] = []; for (let u = end; u !== -1; u = r.prev[u]) out.push(co[u]); return out; };
  const A = search(s, t);
  if (isFinite(A.d[t])) return { pts: [a, ...path(A, t).reverse(), b] };
  const B = search(t, -1);
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < co.length; i++) { if (isFinite(A.d[i])) xs.push(i); if (isFinite(B.d[i])) ys.push(i); }
  const thin = (arr: number[]) => arr.filter((_, i) => i % Math.max(1, Math.floor(arr.length / 600)) === 0);
  let best: [number, number, number] | null = null;
  for (const x of thin(xs)) for (const y of thin(ys)) {
    const c = A.d[x] + 1.5 * dist(co[x], co[y]) + B.d[y];
    if (!best || c < best[0]) best = [c, x, y];
  }
  if (!best) return null;
  return { head: [a, ...path(A, best[1]).reverse()], tail: [...path(B, best[2]), b], gap: [co[best[1]], co[best[2]]] };
}

async function mapboxRoad(a: LngLat, b: LngLat, profile: 'driving' | 'cycling' | 'walking'): Promise<LngLat[] | null> {
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${a[0]},${a[1]};${b[0]},${b[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  try {
    const r = await fetch(url); if (!r.ok) return null;
    const j = await r.json(); const c = j.routes?.[0]?.geometry?.coordinates as LngLat[] | undefined;
    if (!c || c.length < 2 || dist(c[0], a) > 800 || dist(c[c.length - 1], b) > 800) return null;
    return [a, ...c, b];
  } catch { return null; }
}

/** One leg from a to b: trails first, roads for gaps, straight line as a last resort. */
export async function routeLeg(map: mapboxgl.Map, a: LngLat, b: LngLat, profile: 'driving' | 'cycling' | 'walking', warn: (m: string) => void): Promise<Leg> {
  const r = solve(network(map), a, b);
  if (r && 'pts' in r) return { mode: 'follow', points: r.pts, via: 'Trails' };
  if (r && 'gap' in r) {
    const g = dist(r.gap[0], r.gap[1]);
    const bridge = g < 150 ? r.gap : (await mapboxRoad(r.gap[0], r.gap[1], profile)) || (g < 1000 ? r.gap : null);
    if (bridge) return { mode: 'follow', points: [...r.head, ...bridge, ...r.tail], via: 'Trails and roads' };
  }
  const road = await mapboxRoad(a, b, profile);
  if (road) return { mode: 'follow', points: road, via: 'Roads' };
  warn('No trail or road connects those points, so that leg is a Trail Blazer straight line.');
  return { mode: 'blaze', points: [a, b], via: 'Straight line' };
}

/** Climb and descent from the map's terrain, sampled every ~40 m. Needs terrain on (3D) to be exact; null otherwise. */
export function elevationGain(map: mapboxgl.Map, line: LngLat[]): { up: number; down: number; profile: number[] } | null {
  if (line.length < 2 || !map.getTerrain()) return null;
  let up = 0, down = 0, prev: number | null = null; const profile: number[] = [];
  for (let i = 1; i < line.length; i++) {
    const n = Math.max(1, Math.ceil(dist(line[i - 1], line[i]) / 40));
    for (let k = 0; k < n; k++) {
      const t = k / n, p: LngLat = [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
      const e = map.queryTerrainElevation(p, { exaggerated: false });
      if (e == null) return null;
      profile.push(e);
      if (prev != null) { const d = e - prev; if (d > 0) up += d; else down -= d; }
      prev = e;
    }
  }
  return { up, down, profile };
}
