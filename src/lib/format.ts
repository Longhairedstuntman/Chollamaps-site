export const miles = (m: number) => (m / 1609.344).toFixed(m < 16093 ? 1 : 0) + ' mi';
export const feet = (m: number) => Math.round(m * 3.28084).toLocaleString() + ' ft';
export const acres = (m2: number) => (m2 / 4046.856).toFixed(m2 < 404686 ? 1 : 0) + ' ac';
export const km = (m: number) => (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km';
export const meters = (m: number) => Math.round(m).toLocaleString() + ' m';

export function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' d ago';
}

export const coord = (lon: number, lat: number) => `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const todayMMDD = () => { const d = new Date(); return (d.getMonth() + 1) * 100 + d.getDate(); };
const mmdd = (x: number) => M[Math.floor(x / 100) - 1] + ' ' + (x % 100);

// "Open now · closes Nov 15  (May 1 – Nov 15)" from bike_open/bike_close style fields.
export function seasonText(p: Record<string, unknown>, prefix: string): string {
  const o = +(p[prefix + '_open'] ?? 0), c = +(p[prefix + '_close'] ?? 0);
  if (!o || !c) return '';
  const t = todayMMDD(), inside = o <= c ? (t >= o && t <= c) : (t >= o || t <= c);
  return (inside ? 'Open now · closes ' + mmdd(c) : 'Closed now · opens ' + mmdd(o)) + `  (${mmdd(o)} – ${mmdd(c)})`;
}
