import { useEffect, useMemo, useState } from 'react';
import { PIN_KINDS } from '../lib/config';
import { feet, miles } from '../lib/format';
import { download, gpxForLine, gpxForPins, parseImport } from '../lib/gpx';
import { bounds } from '../lib/geo';
import { sb } from '../lib/supabase';
import { deleteItem, folders, focusLine, keyOf, moveToFolder, refreshContent, renameItem, rideLine, routeLine, savePin, saveTrack } from '../content/content';
import { getMap, useApp } from '../state/store';
import { I } from '../shell/Icons';
import Panel from './Panel';

type Tab = 'all' | 'routes' | 'rides' | 'pins' | 'crews';
type Item = { type: 'route' | 'ride' | 'pin'; id: string; title: string; sub: string; folder: string | null; updated: string; line?: [number, number][]; lon?: number; lat?: number; track?: number[][] };

/** My Cholla — onX's My Content: folders on top, categories, search, filter-as-map-moves, select for bulk actions, import and export. */
export default function MyChollaPanel({ onClose }: { onClose: () => void }) {
  const { routes, rides, pins, contentLoaded, hidden, toggleHidden, mapFilter, setMapFilter, session, showToast } = useApp();
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [folder, setFolder] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<'new' | 'old' | 'az'>('new');
  const [, tick] = useState(0);

  useEffect(() => { if (session && !contentLoaded) void refreshContent(); }, [session, contentLoaded]);
  useEffect(() => {
    const map = getMap(); if (!map || !mapFilter) return;
    const h = () => tick((n) => n + 1);
    map.on('moveend', h); return () => { map.off('moveend', h); };
  }, [mapFilter]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const r of routes) out.push({ type: 'route', id: r.client_id, title: r.name, sub: `${miles(r.distance_m)} · ↑ ${feet(r.ascent_m)} · ↓ ${feet(r.descent_m)}`, folder: r.folder, updated: r.updated_at, line: routeLine(r.legs) });
    for (const a of rides) out.push({ type: 'ride', id: a.client_id, title: a.title || 'Ride', sub: `${new Date(a.started_at).toLocaleDateString()} · ${miles(a.distance_m)} · ↑ ${feet(a.elevation_gain_m)}`, folder: a.folder, updated: a.updated_at, line: rideLine(a.track), track: a.track || undefined });
    for (const w of pins) out.push({ type: 'pin', id: w.client_id, title: w.title, sub: `${PIN_KINDS[w.kind]?.label || w.kind}${w.note ? ' · ' + w.note.slice(0, 60) : ''}`, folder: w.folder, updated: w.updated_at, lon: w.lon, lat: w.lat });
    return out;
  }, [routes, rides, pins]);

  const inView = (it: Item) => {
    const map = getMap(); if (!map || !mapFilter) return true;
    const b = map.getBounds(); if (!b) return true;
    if (it.lon != null && it.lat != null) return b.contains([it.lon, it.lat]);
    if (it.line && it.line.length) { const [[w, s], [e, n]] = bounds(it.line); return e >= b.getWest() && w <= b.getEast() && n >= b.getSouth() && s <= b.getNorth(); }
    return true;
  };
  const shown = items
    .filter((it) => tab === 'all' || (tab === 'routes' && it.type === 'route') || (tab === 'rides' && it.type === 'ride') || (tab === 'pins' && it.type === 'pin'))
    .filter((it) => folder === null || it.folder === folder)
    .filter((it) => !q || it.title.toLowerCase().includes(q.toLowerCase()))
    .filter(inView)
    .sort((a, b) => sort === 'az' ? a.title.localeCompare(b.title) : sort === 'new' ? b.updated.localeCompare(a.updated) : a.updated.localeCompare(b.updated));

  const allFolders = folders();
  const show = (it: Item) => {
    const map = getMap(); if (!map) return;
    if (it.line && it.line.length > 1) focusLine(it.line);
    else if (it.lon != null && it.lat != null) map.flyTo({ center: [it.lon, it.lat], zoom: Math.max(map.getZoom(), 14) });
  };
  const exportOne = (it: Item) => {
    if (it.type === 'pin') download(it.title + '.gpx', gpxForPins([{ title: it.title, lon: it.lon!, lat: it.lat!, note: it.sub }]));
    else download(it.title + '.gpx', gpxForLine(it.title, it.line || [], it.track));
  };
  const bulk = (what: 'export' | 'delete' | 'folder' | 'hide') => async () => {
    const picked = shown.filter((it) => selected.has(keyOf(it.type, it.id)));
    if (!picked.length) return;
    if (what === 'export') {
      const lines = picked.filter((p) => p.type !== 'pin'), pts = picked.filter((p) => p.type === 'pin');
      const body = lines.map((l) => gpxForLine(l.title, l.line || [], l.track).replace(/^[\s\S]*?<gpx[^>]*>/, '').replace(/<\/gpx>\s*$/, '')).join('\n')
        + (pts.length ? gpxForPins(pts.map((p) => ({ title: p.title, lon: p.lon!, lat: p.lat! }))).replace(/^[\s\S]*?<gpx[^>]*>/, '').replace(/<\/gpx>\s*$/, '') : '');
      download('cholla-export.gpx', `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Cholla Maps" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`);
    } else if (what === 'delete') {
      if (!confirm(`Delete ${picked.length} item${picked.length > 1 ? 's' : ''}? This also removes them from your phone at its next sync.`)) return;
      for (const p of picked) await deleteItem(p.type, p.id);
    } else if (what === 'folder') {
      const f = prompt('Move to folder (blank for none):', allFolders[0] || '');
      if (f === null) return;
      for (const p of picked) await moveToFolder(p.type, p.id, f.trim() || null);
    } else for (const p of picked) toggleHidden(keyOf(p.type, p.id), true);
    setSelected(new Set()); setSelecting(false);
  };

  const importFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) return showToast('Files up to 8 MB, please.');
    let parsed;
    try { parsed = parseImport(await file.text(), file.name); } catch (e) { return showToast((e as Error).message); }
    const n = parsed.tracks.length + parsed.pins.length;
    if (!n) return showToast('Nothing to import in that file.');
    if (n > 500) return showToast('That file has more than 500 items — split it up first.');
    const f = prompt(`Import ${parsed.tracks.length} track${parsed.tracks.length === 1 ? '' : 's'} and ${parsed.pins.length} pin${parsed.pins.length === 1 ? '' : 's'}. Folder name (blank for none):`, file.name.replace(/\.(gpx|kml)$/i, ''));
    if (f === null) return;
    const fold = f.trim() || null;
    for (const t of parsed.tracks) await saveTrack(t.name, t.points, fold);
    for (const p of parsed.pins) await savePin({ title: p.name, kind: 'pin', note: p.note, lon: p.lon, lat: p.lat, folder: fold });
    await refreshContent();
    showToast(`Imported ${n} item${n === 1 ? '' : 's'}. They’ll be on your phone after its next sync.`);
  };

  if (!session) return <Panel title="My Cholla" onClose={onClose}><p>Sign in to see your routes, rides and pins.</p></Panel>;

  return (
    <Panel title="My Cholla" onClose={onClose} actions={
      <label className="icon-btn" title="Import GPX or KML">{I.download({ style: { transform: 'rotate(180deg)' } })}
        <input type="file" accept=".gpx,.kml" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
      </label>}>
      <div className="seg tabs">
        {(['all', 'routes', 'rides', 'pins', 'crews'] as Tab[]).map((t) => <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
      </div>
      {tab === 'crews' ? <Crews /> : <>
        {allFolders.length > 0 && (
          <div className="chips">
            <button type="button" className="chip" aria-pressed={folder === null} onClick={() => setFolder(null)}>All</button>
            {allFolders.map((f) => <button key={f} type="button" className="chip" aria-pressed={folder === f} onClick={() => setFolder(folder === f ? null : f)}>{I.folder({ width: 14, height: 14 })}{f}</button>)}
          </div>
        )}
        <div className="row">
          <input className="input" placeholder="Search your things" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
            <option value="new">Newest</option><option value="old">Oldest</option><option value="az">A – Z</option>
          </select>
        </div>
        <div className="row between">
          <label className="check"><input type="checkbox" checked={mapFilter} onChange={(e) => setMapFilter(e.target.checked)} /> Only what’s on the map</label>
          <button type="button" className="btn small" onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}>{selecting ? 'Done' : 'Select'}</button>
        </div>
        {selecting && (
          <div className="row wrap">
            <button type="button" className="btn small" onClick={() => setSelected(new Set(shown.map((it) => keyOf(it.type, it.id))))}>Select all</button>
            <button type="button" className="btn small" onClick={bulk('folder')} disabled={!selected.size}>Move to folder</button>
            <button type="button" className="btn small" onClick={bulk('hide')} disabled={!selected.size}>Hide on map</button>
            <button type="button" className="btn small" onClick={bulk('export')} disabled={!selected.size}>Export GPX</button>
            <button type="button" className="btn small danger" onClick={bulk('delete')} disabled={!selected.size}>Delete</button>
          </div>
        )}
        {!shown.length && <p className="fine">{items.length ? 'Nothing matches.' : 'Nothing here yet. Plan a route, drop a pin, or import a GPX — and everything you record on your phone shows up here after Backup & sync (Pro).'}</p>}
        <div className="list">
          {shown.map((it) => {
            const key = keyOf(it.type, it.id), isHidden = hidden.has(key);
            return (
              <div key={key} className={'item' + (isHidden ? ' hidden-item' : '')}>
                {selecting && <input type="checkbox" checked={selected.has(key)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(key); else n.delete(key); setSelected(n); }} />}
                <button type="button" className="item-main" onClick={() => show(it)}>
                  <span className={'dot ' + it.type} />
                  <strong>{it.title}</strong><small>{it.sub}{it.folder ? ' · ' + it.folder : ''}</small>
                </button>
                <div className="item-actions">
                  <button type="button" className="icon-btn" title={isHidden ? 'Show on map' : 'Hide on map'} onClick={() => toggleHidden(key)}>{isHidden ? I.eyeOff({ width: 16, height: 16 }) : I.eye({ width: 16, height: 16 })}</button>
                  <button type="button" className="icon-btn" title="Export GPX" onClick={() => exportOne(it)}>{I.download({ width: 16, height: 16 })}</button>
                  <button type="button" className="icon-btn" title="Rename" onClick={() => { const n = prompt('Name', it.title); if (n && n.trim()) void renameItem(it.type, it.id, n.trim()); }}>Aa</button>
                  <button type="button" className="icon-btn" title="Move to folder" onClick={() => { const f = prompt('Folder (blank for none):', it.folder || ''); if (f !== null) void moveToFolder(it.type, it.id, f.trim() || null); }}>{I.folder({ width: 16, height: 16 })}</button>
                  <button type="button" className="icon-btn danger" title="Delete" onClick={() => { if (confirm(`Delete “${it.title}”?`)) void deleteItem(it.type, it.id); }}>{I.trash({ width: 16, height: 16 })}</button>
                </div>
              </div>
            );
          })}
        </div>
      </>}
    </Panel>
  );
}

function Crews() {
  const [crews, setCrews] = useState<Array<{ id: string; name: string; member_count?: number }> | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, Array<{ title: string; item_type: string; is_public: boolean; shared_by_me: boolean; shared_by_name?: string; route_legs?: Array<{ points: [number, number][] }>; lon?: number; lat?: number }>>>({});
  useEffect(() => { sb.rpc('my_crews').then(({ data }) => setCrews((data as typeof crews) || [])); }, []);
  const load = async (id: string) => {
    setOpen(open === id ? null : id);
    if (items[id]) return;
    const { data } = await sb.rpc('crew_folder', { p_crew: id });
    setItems((m) => ({ ...m, [id]: (data as typeof items[string]) || [] }));
  };
  if (!crews) return <p className="fine">Loading crews…</p>;
  if (!crews.length) return <p className="fine">No crews yet. Make one in the Crew tab on your phone — shared routes and pins show up here.</p>;
  return (
    <div className="list">
      {crews.map((c) => (
        <div key={c.id} className="item column">
          <button type="button" className="item-main" onClick={() => load(c.id)}><strong>{c.name}</strong><small>{c.member_count ?? ''} members</small></button>
          {open === c.id && (items[c.id] || []).map((it, i) => (
            <button key={i} type="button" className="sub-item" onClick={() => {
              const line = (it.route_legs || []).flatMap((l) => l.points || []);
              if (line.length > 1) focusLine(line); else if (it.lon != null) getMap()?.flyTo({ center: [it.lon, it.lat!], zoom: 14 });
            }}>
              <strong>{it.title}</strong><small>{it.item_type} · {it.shared_by_me ? 'you' : it.shared_by_name || 'a member'}</small>
            </button>
          ))}
          {open === c.id && items[c.id] && !items[c.id].length && <p className="fine">Nothing shared to this crew yet.</p>}
        </div>
      ))}
    </div>
  );
}
