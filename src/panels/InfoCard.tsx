import { useEffect, useState } from 'react';
import { CONDITIONS, DIFF, LAND, PIN_KINDS } from '../lib/config';
import { ago, coord, seasonText } from '../lib/format';
import { sb } from '../lib/supabase';
import { snotelLatest } from '../map/overlays';
import { deleteItem, keyOf, savePin } from '../content/content';
import { getMap, useApp } from '../state/store';
import { I } from '../shell/Icons';
import { formatView } from '../lib/url';

const Uses = ({ items }: { items: Array<[string, unknown]> }) => (
  <div className="uses">{items.map(([l, on]) => <span key={l} className={on ? 'on' : ''} title={l + (on ? ' allowed' : ' not allowed')}>{l}</span>)}</div>
);
const Rows = ({ rows }: { rows: Array<[string, unknown]> }) => {
  const shown = rows.filter((r) => r[1]);
  return shown.length ? <dl className="rows">{shown.map((r) => <div key={r[0]}><dt>{r[0]}</dt><dd>{String(r[1])}</dd></div>)}</dl> : null;
};
const Source = ({ p }: { p: Record<string, unknown> }) => (p.src || p.asof) ? <p className="src">{String(p.src || '')} · retrieved {String(p.asof || '—')}</p> : null;

/** The info card: what onX opens when you click anything — details, then the things you can do here. */
export default function InfoCard() {
  const info = useApp((s) => s.info), setInfo = useApp((s) => s.setInfo);
  const openWeather = useApp((s) => s.openWeather), startRouteAt = useApp((s) => s.startRouteAt), toast = useApp((s) => s.showToast);
  const session = useApp((s) => s.session);
  const [pinning, setPinning] = useState(false);
  useEffect(() => { setPinning(false); }, [info]);
  if (!info) return null;
  const p = info.props, [lon, lat] = info.lngLat;

  const share = async () => {
    const map = getMap(); if (!map) return;
    const url = `${location.origin}/map/${formatView({ lat, lon, zoom: Math.max(map.getZoom(), 13) })}?at=${lon.toFixed(5)},${lat.toFixed(5)}`;
    try { await navigator.clipboard.writeText(url); toast('Link copied. Anyone with a Cholla account can open it.'); } catch { prompt('Copy this link', url); }
  };

  let eyebrow = '', title = '', body: React.ReactNode = null;
  switch (info.kind) {
    case 'trail':
      eyebrow = 'Trail'; title = String(p.name || 'Unnamed trail');
      body = <>
        <Uses items={[['Hike', p.foot], ['Bike', p.bike], ['Moto', p.moto], ['ATV', p.atv]]} />
        {p.diff && DIFF[String(p.diff)] && <p className="diff"><i style={{ background: DIFF[String(p.diff)].day }} />{DIFF[String(p.diff)].label} · MTB rating</p>}
        <Rows rows={[['Bikes', seasonText(p, 'bike')], ['Motorcycles', seasonText(p, 'moto')], ['Surface', p.surface], ['Length', p.len_mi ? `${p.len_mi} mi` : '']]} />
        <Source p={p} />
        <TrailCommunity trailKey={p.tid ? String(p.tid) : ''} />
      </>;
      break;
    case 'mvum':
      eyebrow = p.kind === 'trail' ? 'Forest Service trail' : 'Forest Service road'; title = String(p.name || 'Unnamed route');
      body = <>
        <Uses items={[['Car', p.car], ['High clearance', p.hc], ['ATV', p.atv], ['Moto', p.moto]]} />
        <Rows rows={[['Motorcycles', seasonText(p, 'moto')], ['ATVs', seasonText(p, 'atv')], ['High clearance', seasonText(p, 'hc')], ['Maintenance', p.maint]]} />
        <p className="note">This is the legal map, not a condition report — a legal road can still be washed out.</p>
        <Source p={p} />
      </>;
      break;
    case 'land':
      eyebrow = 'Land'; title = (LAND[String(p.agency)] || ['Public land'])[0];
      body = <>{p.unit ? <p className="note">{String(p.unit)}</p> : null}<p className="note">Boundaries are generalized. Check signs on the ground before you camp or cross.</p><Source p={p} /></>;
      break;
    case 'trailhead':
      eyebrow = 'Trailhead'; title = String(p.name || p.title || 'Trailhead');
      body = <Rows rows={[['Parking', p.parking], ['Toilets', p.toilets], ['Fee', p.fee], ['Source', p.source || p.src]]} />;
      break;
    case 'campsite':
      eyebrow = p.paid || p.kind === 'paid' ? 'Campground' : 'Dispersed camping'; title = String(p.name || p.title || 'Campsite');
      body = <><Rows rows={[['Type', p.kind], ['Sites', p.sites], ['Fee', p.fee], ['Season', p.season], ['Added by', p.added_by]]} />
        {p.note ? <p className="note">{String(p.note)}</p> : null}
        {p.reservation_url ? <a className="btn" href={String(p.reservation_url)} target="_blank" rel="noreferrer">Reservations</a> : null}</>;
      break;
    case 'campground':
      eyebrow = 'Forest Service campground'; title = String(p.recareaname || 'Campground');
      body = <Rows rows={[['Type', p.markeractivity], ['Status', p.openstatus], ['Forest', p.forestname]]} />;
      break;
    case 'fire':
      eyebrow = 'Active wildfire'; title = String(p.poly_IncidentName || 'Fire');
      body = <Rows rows={[['Contained', p.attr_PercentContained != null ? `${p.attr_PercentContained}%` : ''], ['Size', p.poly_GISAcres ? `${Math.round(Number(p.poly_GISAcres)).toLocaleString()} acres` : '']]} />;
      break;
    case 'avalanche':
      eyebrow = 'Avalanche forecast'; title = String(p.name || 'Zone');
      body = <><Rows rows={[['Danger today', p.offline ? 'Not available offline' : String(p.danger || 'no rating').replace(/^\w/, (c) => c.toUpperCase())],
          ...(p.elevations ? (() => { const e = p.elevations as { alp?: string; tln?: string; btl?: string }; const w = (v?: string) => (v || '').replace(/([A-Z])/g, ' $1').replace(/^\w/, (c) => c.toUpperCase()); return [['Above treeline', w(e.alp)], ['Near treeline', w(e.tln)], ['Below treeline', w(e.btl)]] as Array<[string, string]>; })() : []),
          ['Center', p.center], ['Issued', p.start_date ? new Date(String(p.start_date)).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '']]} />
        {p.travel_advice ? <p className="note">{String(p.travel_advice)}</p> : null}
        <p className="note">The color is the day’s highest rating across elevations. Read the full forecast for the problems, aspects and elevations that matter today.</p>
        {p.link ? <a className="btn" href={String(p.link)} target="_blank" rel="noreferrer">Full forecast</a> : null}</>;
      break;
    case 'snotel':
      eyebrow = 'SNOTEL station'; title = String(p.name || 'Station');
      body = <Snotel triplet={String(p.triplet)} elevation={p.elevation_ft ? Number(p.elevation_ft) : undefined} />;
      break;
    case 'pin':
      eyebrow = PIN_KINDS[String(p.pinKind)]?.label || 'Pin'; title = String(p.title || 'Pin');
      body = <>{p.note ? <p className="note">{String(p.note)}</p> : null}<Rows rows={[['Folder', p.folder], ['Where', coord(lon, lat)]]} />
        <button type="button" className="btn small danger" onClick={() => { if (confirm(`Delete “${title}”?`)) { void deleteItem('pin', String(p.client_id)); setInfo(null); } }}>{I.trash({ width: 14, height: 14 })} Delete pin</button>
        <button type="button" className="btn small" onClick={() => useApp.getState().toggleHidden(keyOf('pin', String(p.client_id)), true)}>Hide on map</button></>;
      break;
    default:
      eyebrow = 'This spot'; title = coord(lon, lat);
      body = <Rows rows={[['Land', p.land ? (LAND[String(p.land)] || ['Public land'])[0] : 'Not in the land layer'], ['Unit', p.unit]]} />;
  }

  return (
    <section className="infocard" aria-live="polite">
      <button type="button" className="icon-btn close" onClick={() => setInfo(null)} aria-label="Close">{I.close()}</button>
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {body}
      <div className="actions">
        {pinning ? <PinForm lon={lon} lat={lat} suggested={info.kind === 'spot' ? '' : title} onDone={() => { setPinning(false); setInfo(null); }} />
          : <>
            {info.kind !== 'pin' && <button type="button" className="btn small" onClick={() => session ? setPinning(true) : toast('Sign in to drop pins.')}>{I.pin({ width: 14, height: 14 })} Pin here</button>}
            <button type="button" className="btn small" onClick={() => startRouteAt([lon, lat])}>{I.route({ width: 14, height: 14 })} Route from here</button>
            <button type="button" className="btn small" onClick={() => openWeather([lon, lat])}>{I.weather({ width: 14, height: 14 })} Weather</button>
            <button type="button" className="btn small" onClick={share}>{I.share({ width: 14, height: 14 })} Share</button>
          </>}
      </div>
    </section>
  );
}

function PinForm({ lon, lat, suggested, onDone }: { lon: number; lat: number; suggested: string; onDone: () => void }) {
  const [title, setTitle] = useState(suggested);
  const [kind, setKind] = useState('pin');
  const [note, setNote] = useState('');
  return (
    <form className="pinform" onSubmit={async (e) => { e.preventDefault(); if (await savePin({ title: title || 'Pin', kind, note, lon, lat })) { useApp.getState().showToast('Pinned. It’ll be on your phone after the next sync.'); onDone(); } }}>
      <input className="input" placeholder="Name" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus />
      <div className="chips">{Object.entries(PIN_KINDS).map(([k, v]) => <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}><i className="sw dot" style={{ background: v.color }} />{v.label}</button>)}</div>
      <input className="input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      <div className="row"><button type="submit" className="btn primary small">Save pin</button><button type="button" className="btn small" onClick={onDone}>Cancel</button></div>
    </form>
  );
}

function Snotel({ triplet, elevation }: { triplet: string; elevation?: number }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof snotelLatest>> | undefined>(undefined);
  useEffect(() => { setD(undefined); snotelLatest(triplet).then(setD); }, [triplet]);
  return <Rows rows={[['Elevation', elevation ? `${Math.round(elevation).toLocaleString()} ft` : ''],
    ['Snow depth', d === undefined ? 'Loading…' : d?.depth_in != null ? `${d.depth_in} in` : 'No reading'],
    ['Water equivalent', d?.swe_in != null ? `${d.swe_in} in` : ''], ['As of', d?.date || '']]} />;
}

interface Cond { status: string; reporter?: string; observed_at: string; note?: string }
function TrailCommunity({ trailKey }: { trailKey: string }) {
  const session = useApp((s) => s.session), toast = useApp((s) => s.showToast);
  const [conds, setConds] = useState<Cond[] | null>(null);
  const [summary, setSummary] = useState<{ avg_stars?: number; rating_count?: number } | null>(null);
  const [guide, setGuide] = useState<{ body: string; best_direction?: string; season?: string; access?: string; status: string } | null>(null);
  const [posts, setPosts] = useState<Array<{ body: string; created_at: string }>>([]);
  const [status, setStatus] = useState('good'), [note, setNote] = useState('');
  const load = async () => {
    const [s, c, g, p] = await Promise.all([
      sb.rpc('trail_summary', { p_key: trailKey }), sb.rpc('trail_condition_reports', { p_key: trailKey }),
      sb.from('trail_guides').select('*').eq('trail_key', trailKey).maybeSingle(),
      sb.from('trail_posts').select('body, created_at').eq('trail_key', trailKey).is('hidden_at', null).order('created_at', { ascending: false }).limit(10)
    ]);
    setSummary((s.data as typeof summary[])?.[0] || null); setConds((c.data as Cond[]) || []); setGuide(g.data as typeof guide); setPosts((p.data as typeof posts) || []);
  };
  useEffect(() => { if (trailKey && session) void load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [trailKey, session]);
  if (!trailKey) return null;
  if (!session) return <p className="fine">Sign in for conditions, the trail guide and rider posts.</p>;
  return (
    <div className="community">
      {summary?.avg_stars ? <p className="stars">{'★'.repeat(Math.round(summary.avg_stars))} {summary.avg_stars} · {summary.rating_count} ratings</p> : null}
      <div className="eyebrow">Conditions</div>
      {conds === null && <p className="fine">Loading…</p>}
      {conds && !conds.length && <p className="fine">No reports in the last 30 days.</p>}
      {conds?.slice(0, 5).map((r, i) => { const [label, color] = CONDITIONS[r.status] || [r.status, '#888']; return (
        <p key={i} className="cond"><i style={{ background: color }} /><b>{label}</b> · {r.reporter || 'A rider'} · {ago(r.observed_at)}{r.note ? <><br />{r.note}</> : null}</p>); })}
      <form className="row wrap" onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await sb.from('trail_conditions').insert({ trail_key: trailKey, user_id: session.user.id, status, note: note || null });
        if (error) return toast('Couldn’t post: ' + error.message);
        toast('Thanks — posted.'); setNote(''); void load();
      }}>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Condition">{Object.entries(CONDITIONS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <input className="input grow" placeholder="Details (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        <button type="submit" className="btn small">Report</button>
      </form>
      {guide?.status === 'published' && <>
        <div className="eyebrow">Trail guide</div><p className="guide">{guide.body}</p>
        <Rows rows={[['Best direction', guide.best_direction], ['Season', guide.season], ['Getting there', guide.access]]} />
      </>}
      {posts.length > 0 && <><div className="eyebrow">Rider posts</div>{posts.map((p, i) => <p key={i} className="post">{p.body}<br /><small>{ago(p.created_at)}</small></p>)}</>}
    </div>
  );
}
