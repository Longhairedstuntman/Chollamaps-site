import type { LngLat } from './geo';

const esc = (s: string) => String(s).replace(/[<&"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' }[c] as string));

export function gpxForLine(name: string, line: LngLat[], track?: number[][]): string {
  const pts = track && track.length
    ? track.map((p) => `<trkpt lat="${p[1]}" lon="${p[0]}"><ele>${p[2] ?? 0}</ele>${p[3] ? `<time>${new Date(p[3] * 1000).toISOString()}</time>` : ''}</trkpt>`)
    : line.map((p) => `<trkpt lat="${p[1]}" lon="${p[0]}"/>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Cholla Maps" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${esc(name)}</name><trkseg>\n${pts.join('\n')}\n</trkseg></trk></gpx>\n`;
}

export function gpxForPins(pins: Array<{ title: string; lon: number; lat: number; note?: string | null }>): string {
  const w = pins.map((p) => `<wpt lat="${p.lat}" lon="${p.lon}"><name>${esc(p.title)}</name>${p.note ? `<desc>${esc(p.note)}</desc>` : ''}</wpt>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Cholla Maps" xmlns="http://www.topografix.com/GPX/1/1">\n${w.join('\n')}\n</gpx>\n`;
}

export function download(filename: string, text: string, type = 'application/gpx+xml') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename.replace(/[^\w.-]+/g, '-');
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export interface ImportedTrack { name: string; points: LngLat[] }
export interface ImportedPin { name: string; lon: number; lat: number; note?: string }
export interface Imported { tracks: ImportedTrack[]; pins: ImportedPin[] }

// GPX and KML in, the way onX does it: tracks/routes/lines become tracks, points become pins.
export function parseImport(text: string, filename: string): Imported {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('That file isn’t valid GPX or KML.');
  const out: Imported = { tracks: [], pins: [] };
  const base = filename.replace(/\.(gpx|kml)$/i, '');
  const tx = (el: Element | null | undefined, sel: string) => el?.querySelector(sel)?.textContent?.trim() || '';

  if (doc.documentElement.localName === 'gpx') {
    doc.querySelectorAll('wpt').forEach((w) => {
      out.pins.push({ name: tx(w, 'name') || 'Pin', lat: +w.getAttribute('lat')!, lon: +w.getAttribute('lon')!, note: tx(w, 'desc') || undefined });
    });
    doc.querySelectorAll('trk').forEach((t, i) => {
      const pts: LngLat[] = [];
      t.querySelectorAll('trkpt').forEach((p) => pts.push([+p.getAttribute('lon')!, +p.getAttribute('lat')!]));
      if (pts.length > 1) out.tracks.push({ name: tx(t, 'name') || `${base} ${i + 1}`, points: pts });
    });
    doc.querySelectorAll('rte').forEach((t, i) => {
      const pts: LngLat[] = [];
      t.querySelectorAll('rtept').forEach((p) => pts.push([+p.getAttribute('lon')!, +p.getAttribute('lat')!]));
      if (pts.length > 1) out.tracks.push({ name: tx(t, 'name') || `${base} route ${i + 1}`, points: pts });
    });
    return out;
  }
  // KML
  doc.querySelectorAll('Placemark').forEach((pm, i) => {
    const name = tx(pm, 'name') || `${base} ${i + 1}`;
    const point = pm.querySelector('Point coordinates');
    if (point) {
      const [lon, lat] = point.textContent!.trim().split(/[\s,]+/).map(Number);
      if (!Number.isNaN(lon) && !Number.isNaN(lat)) out.pins.push({ name, lon, lat, note: tx(pm, 'description') || undefined });
      return;
    }
    pm.querySelectorAll('LineString coordinates, LinearRing coordinates').forEach((c) => {
      const pts: LngLat[] = [];
      for (const triple of c.textContent!.trim().split(/\s+/)) {
        const [lon, lat] = triple.split(',').map(Number);
        if (!Number.isNaN(lon) && !Number.isNaN(lat)) pts.push([lon, lat]);
      }
      if (pts.length > 1) out.tracks.push({ name, points: pts });
    });
  });
  return out;
}
