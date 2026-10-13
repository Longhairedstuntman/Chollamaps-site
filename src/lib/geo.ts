export type LngLat = [number, number];

export function dist(a: LngLat, b: LngLat): number {
  const R = 6371000, k = Math.PI / 180;
  const dLat = (b[1] - a[1]) * k, dLon = (b[0] - a[0]) * k;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * k) * Math.cos(b[1] * k) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const lineLength = (pts: LngLat[]) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);

// Shoelace on a local flat projection — fine at trail scale. Square meters.
export function polygonArea(pts: LngLat[]): number {
  if (pts.length < 3) return 0;
  const lat0 = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += (p[0] * kx) * (q[1] * ky) - (q[0] * kx) * (p[1] * ky);
  }
  return Math.abs(a) / 2;
}

export function bounds(pts: LngLat[]): [LngLat, LngLat] {
  let w = 180, s = 90, e = -180, n = -90;
  for (const p of pts) { w = Math.min(w, p[0]); s = Math.min(s, p[1]); e = Math.max(e, p[0]); n = Math.max(n, p[1]); }
  return [[w, s], [e, n]];
}

export const dedupe = (pts: LngLat[]) => pts.filter((p, i) => !i || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);

// "38.5733, -109.5498" / "38.5733 -109.5498" / "38.5733,-109.5498"
export function parseCoords(text: string): LngLat | null {
  const m = text.trim().match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = +m[1], lon = +m[2];
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return [lon, lat];
}
