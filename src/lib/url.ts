/* Map state in the URL, onX-style: /map/@38.5733,-109.5498,12.4z?b=sat&a=mtb&l=trails,mvum,land
   Reload or share the link and you land on the same view. */
import type { Activity, BaseId } from './config';
import { DEFAULT_VIEW } from './config';

export interface ViewState { lat: number; lon: number; zoom: number; pitch?: number; bearing?: number }

export function parseView(segment: string | undefined): ViewState | null {
  if (!segment || !segment.startsWith('@')) return null;
  const parts = segment.slice(1).replace(/z$/, '').split(',').map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [lat, lon, zoom, pitch, bearing] = parts;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, zoom: Math.max(2, Math.min(22, zoom)), pitch, bearing };
}

export function formatView(v: ViewState): string {
  const base = `@${v.lat.toFixed(5)},${v.lon.toFixed(5)},${v.zoom.toFixed(2)}z`;
  const p = Math.round(v.pitch ?? 0), b = Math.round(v.bearing ?? 0);
  return p || b ? `${base.slice(0, -1)},${p},${b}z` : base;
}

export const initialView = (): ViewState => {
  try {
    const saved = localStorage.getItem('cholla.view');
    if (saved) { const v = JSON.parse(saved) as ViewState; if (v && typeof v.lat === 'number') return v; }
  } catch { /* private mode etc. */ }
  return { ...DEFAULT_VIEW };
};

export const rememberView = (v: ViewState) => { try { localStorage.setItem('cholla.view', JSON.stringify(v)); } catch { /* ignore */ } };

export interface UrlPrefs { base?: BaseId; activity?: Activity; layers?: string[] }
export function parsePrefs(search: string): UrlPrefs {
  const q = new URLSearchParams(search);
  const out: UrlPrefs = {};
  const b = q.get('b'); if (b === 'topo' || b === 'night' || b === 'sat') out.base = b;
  const a = q.get('a'); if (a === 'mtb' || a === 'moto' || a === 'hike' || a === 'ski' || a === 'snowmobile' || a === 'all') out.activity = a;
  const l = q.get('l'); if (l !== null) out.layers = l ? l.split(',') : [];
  return out;
}
export function formatPrefs(base: BaseId, activity: Activity, layers: string[]): string {
  const q = new URLSearchParams();
  q.set('b', base); q.set('a', activity); q.set('l', layers.join(','));
  return '?' + q.toString();
}
