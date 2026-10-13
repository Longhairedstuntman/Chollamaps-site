import { useEffect, useState } from 'react';
import { AREAS, DIFF } from '../lib/config';
import { getMap, useApp } from '../state/store';
import Panel from './Panel';

interface Row { name: string; diff?: string; tid?: string; props: Record<string, unknown>; lngLat: [number, number] }

/** Explore — onX's Discover: areas to jump to, and the trails on the map right now. */
export default function ExplorePanel({ onClose }: { onClose: () => void }) {
  const tilted = useApp((s) => s.tilted), setInfo = useApp((s) => s.setInfo);
  const [rows, setRows] = useState<Row[]>([]);
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    const map = getMap(); if (!map) return;
    const scan = () => {
      setZoom(map.getZoom());
      if (!map.getLayer('trails')) return;
      const seen = new Map<string, Row>();
      for (const f of map.queryRenderedFeatures({ layers: ['trails', 'trails-closed'] })) {
        const p = f.properties || {}; const name = String(p.name || ''); if (!name) continue;
        const key = String(p.tid || name);
        if (seen.has(key)) continue;
        const g = f.geometry; const c = g.type === 'LineString' ? g.coordinates[0] : g.type === 'MultiLineString' ? g.coordinates[0][0] : null;
        if (!c) continue;
        seen.set(key, { name, diff: p.diff ? String(p.diff) : undefined, tid: p.tid ? String(p.tid) : undefined, props: p, lngLat: [c[0], c[1]] });
      }
      setRows([...seen.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 80));
    };
    scan();
    map.on('idle', scan);
    return () => { map.off('idle', scan); };
  }, []);

  return (
    <Panel title="Explore" onClose={onClose}>
      <div className="eyebrow">Jump to an area</div>
      <div className="chips">
        {AREAS.map(([name, b]) => (
          <button key={name} type="button" className="chip" onClick={() => getMap()?.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 60, bottom: 60, left: 440, right: 120 }, pitch: tilted ? 55 : 0 })}>{name}</button>
        ))}
      </div>
      <div className="eyebrow">Trails on the map</div>
      {zoom < 10 && <p className="fine">Zoom in to list the trails in view.</p>}
      {zoom >= 10 && !rows.length && <p className="fine">No trails in view for this activity.</p>}
      <div className="list">
        {rows.map((r) => (
          <button key={(r.tid || '') + r.name} type="button" className="item-main item" onClick={() => { setInfo({ kind: 'trail', props: r.props, lngLat: r.lngLat }); getMap()?.panTo(r.lngLat); }}>
            <span className="dot" style={{ background: r.diff && DIFF[r.diff] ? DIFF[r.diff].day : '#8A8F7A' }} />
            <strong>{r.name}</strong><small>{r.diff && DIFF[r.diff] ? DIFF[r.diff].label : 'Not rated'}{r.props.surface ? ' · ' + String(r.props.surface) : ''}</small>
          </button>
        ))}
      </div>
    </Panel>
  );
}
