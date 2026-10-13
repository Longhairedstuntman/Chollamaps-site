import { ACTIVITIES, type Activity } from '../lib/config';
import { useApp } from '../state/store';
import { I } from './Icons';

/** Top: the search field and the activity switcher (onX: Search + Filters / Activity, top-left). */
export default function TopBar() {
  const activity = useApp((s) => s.activity), setActivity = useApp((s) => s.setActivity);
  const setPanel = useApp((s) => s.setPanel), panel = useApp((s) => s.panel);
  return (
    <div className="topbar">
      <button type="button" className="searchbox" onClick={() => { if (panel !== 'search') setPanel('search'); }} aria-label="Search trails, places and coordinates">
        {I.search()}<span>Search trails, places, coordinates…</span>
      </button>
      <div className="seg" role="group" aria-label="Activity">
        {(Object.keys(ACTIVITIES) as Activity[]).map((k) => (
          <button key={k} type="button" aria-pressed={activity === k} title={ACTIVITIES[k].blurb} onClick={() => setActivity(k)}>
            {k !== 'all' && <span className="glyph" style={{ ['--glyph' as string]: `url(/glyphs/activity-${k}.svg)` }} aria-hidden />}
            {ACTIVITIES[k].label}
          </button>
        ))}
      </div>
    </div>
  );
}
