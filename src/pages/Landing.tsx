import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { BASES, MAPBOX_TOKEN } from '../lib/config';
import { addAll } from '../map/overlays';
import { LAYERS, GROUPS } from '../map/layers';
import { useApp } from '../state/store';

mapboxgl.accessToken = MAPBOX_TOKEN;

// Redfish Lake, Sawtooths, looking southwest at Mt. Heyburn. People can look around,
// but only inside the Sawtooth fence below, and only between these zooms.
// From the south-west corner of Redfish Lake, looking straight at Mt. Heyburn (-114.976, 44.101).
const HERO = { center: [-114.964, 44.109] as [number, number], zoom: 13.75, pitch: 68, bearing: 229 };
const HERO_FENCE: [[number, number], [number, number]] = [[-115.25, 43.93], [-114.60, 44.33]];
// Captured from ?still=1 in a 1728×962 CSS-px window: the live map shows the same ground at HERO.zoom in a box that tall.
const HERO_STILL = { src: '/brand/hero-sawtooths.jpg', w: 1728, h: 962 };
const CAPTURE = new URLSearchParams(window.location.search).has('still');
const IDLE_MS = 15000;
// The modifier Mapbox's cooperative gestures want for scroll-zoom: ⌘ on a Mac, Ctrl everywhere else.
const MOD = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘' : 'Ctrl';

/** The hero is the product: Redfish Lake and Mt. Heyburn in 3D, from the first frame. The still is
    underneath; the live map's own background is transparent, so its tiles sharpen into place over the
    picture without the camera ever moving. Then it turns slowly until someone touches it, and flies
    home 15 s after they stop. */
function HeroMap({ onExplore }: { onExplore: (on: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Mapbox sets the camera distance from the viewport height, so the still is scaled by height and
    // the live map gets the zoom at which it shows exactly the same ground. (The still is wider than
    // nearly every screen; a blurred copy fills the edges on an ultra-wide one.)
    const scale = CAPTURE ? 1 : el.clientHeight / HERO_STILL.h;
    const home = { center: HERO.center, zoom: HERO.zoom + Math.log2(scale), pitch: HERO.pitch, bearing: HERO.bearing };
    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: el, style: BASES.sat.url, ...home,
        maxBounds: HERO_FENCE, minZoom: 11, maxZoom: 15.5, maxPitch: 78, fadeDuration: 400,
        cooperativeGestures: !CAPTURE, interactive: !CAPTURE, attributionControl: false, antialias: true
      });
    } catch { el.classList.add('fallback'); return; }
    if (!CAPTURE) map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    (window as unknown as { heroMap?: mapboxgl.Map }).heroMap = map; // for tuning HERO and diagnosing loads from the console
    let frame = 0, last = 0, touched = false, flying = false, poll = 0, idle = 0;
    const spin = (t: number) => {
      if (touched || flying) return;
      if (last) map.setBearing(map.getBearing() + (t - last) * 0.0007);
      last = t; frame = requestAnimationFrame(spin);
    };
    // Glide back to the start and pick the slow turn up again. A straight ease, not flyTo: flyTo's
    // zoom-out arc swings a pitched camera up over the whole horizon of terrain and stutters.
    const goHome = () => {
      if (!touched) return;
      flying = true; onExplore(false);
      const c = map.getCenter();
      const km = Math.hypot((c.lng - HERO.center[0]) * 80, (c.lat - HERO.center[1]) * 111);
      const duration = Math.min(4500, 2600 + km * 120 + Math.abs(map.getPitch() - HERO.pitch) * 12);
      const easing = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      map.easeTo({ ...home, duration, easing, essential: true });
      map.once('moveend', () => {
        if (!flying) return; // someone grabbed it mid-flight
        flying = false; touched = false; last = 0;
        if (!reduce) frame = requestAnimationFrame(spin);
      });
    };
    const bump = () => { clearTimeout(idle); idle = window.setTimeout(goHome, IDLE_MS); };
    // Any real use of the map: stop the turn, clear the headline out of the way, start the idle clock.
    // Page scrolling over the map (no ⌘, one finger) is not use.
    const touch = (e: Event) => {
      if (e instanceof WheelEvent && !(e.ctrlKey || e.metaKey)) return;
      if (e instanceof TouchEvent && e.touches.length < 2) return;
      touched = true; flying = false; cancelAnimationFrame(frame);
      el.classList.add('ready'); onExplore(true); bump();
    };
    if (!CAPTURE) {
      for (const ev of ['mousedown', 'touchstart', 'wheel'] as const) el.addEventListener(ev, touch, { passive: true });
      map.on('move', () => { if (touched && !flying) bump(); });
    }
    map.on('style.load', () => {
      if (!map.getSource('mapbox-dem')) map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.3 });
      map.setFog({ range: [0.8, 9], color: '#DCE3EA', 'horizon-blend': 0.08, 'high-color': '#9FB8D1', 'space-color': '#1B2A33', 'star-intensity': 0 });
      addAll(map, { base: 'sat', activity: 'all', layers: new Set(['trails', 'mvum']), signedIn: false });
      // Let the still show through wherever a tile hasn't arrived yet.
      if (!CAPTURE) for (const l of map.getStyle()?.layers || []) if (l.type === 'background') map.setPaintProperty(l.id, 'background-opacity', 0);
      // The camera Mapbox builds from center + zoom depends on the ground height under the center,
      // which it only knows once the terrain tile is in — so wait for that (and for the tiles to
      // settle), re-apply the home camera, and only then fade the live map in and start the slow turn.
      // Until the ground height under the center is known, placing the camera from center + zoom
      // puts it inside the mountain. So the still stays up — it is the right picture — until the
      // terrain has answered and the tiles have settled; only then is the home camera locked and
      // the live map faded in. On a slow connection, or in a tab opened in the background (tiles
      // don't load until it is looked at), that simply takes longer. Someone who grabs the map
      // first gets it as is.
      let ok = 0, lastElev = -1; const t0 = Date.now();
      poll = window.setInterval(() => {
        const elev = map.queryTerrainElevation(HERO.center) ?? -1;
        ok = map.areTilesLoaded() && elev > 0 && Math.abs(elev - lastElev) < 1 ? ok + 1 : 0;
        lastElev = elev;
        if (touched) { clearInterval(poll); return; }
        if (ok >= 4 && Date.now() - t0 > 2500) {
          clearInterval(poll);
          map.jumpTo(home);
          el.classList.add('ready');
          if (!CAPTURE && !reduce) frame = requestAnimationFrame(spin);
        }
      }, 400);
    });
    map.on('error', () => el.classList.add('fallback'));
    return () => { cancelAnimationFrame(frame); clearInterval(poll); clearTimeout(idle); map.remove(); };
  }, [onExplore]);
  return <>
    {!CAPTURE && <img className="hero-fill" src={HERO_STILL.src} alt="" aria-hidden="true" />}
    {!CAPTURE && <img className="hero-still" src={HERO_STILL.src} alt="" aria-hidden="true" />}
    <div ref={box} className="hero-map" />
  </>;
}

const STYLE_IDS = { topo: 'cmuu3gvmd00cu01ss75794num', night: 'cmuu3nkm500cv01ssc7g1di5y', sat: 'cmuu3r7ce00aw01r7c3o1a4ry' };
const shot = (id: string, lon: number, lat: number, zoom: number, bearing = 0, pitch = 0) =>
  `https://api.mapbox.com/styles/v1/bcmaps5/${id}/static/${lon},${lat},${zoom},${bearing},${pitch}/800x560@2x?access_token=${MAPBOX_TOKEN}`;
const BASEMAP_SHOTS = [
  { label: 'Topo', place: 'La Sal Mountains', src: shot(STYLE_IDS.topo, -109.27, 38.46, 11.6) },
  { label: 'Night', place: 'Park City', src: shot(STYLE_IDS.night, -111.52, 40.63, 12.6) },
  { label: 'Satellite', place: 'Slickrock, Moab', src: shot(STYLE_IDS.sat, -109.52, 38.58, 13.4, 20, 45) }
];

const STEPS: Array<[string, string]> = [
  ['Plan it here', 'Build the route on a big screen. Snap to trails and Forest Service roads, or draw straight across where there is no trail. Distance, climb and the elevation profile update as you click.'],
  ['It is on your phone', 'Save, and the route is in the Cholla app the next time it syncs. Pins and folders come along. Download the area for offline use before you lose signal.'],
  ['Ride it, report back', 'Turn-by-turn on the phone, with the map working offline. Afterward, tell the next rider how the trail was. Reports show on the map for two weeks.']
];

const FREE = ['The whole map, all three base maps', 'Trails, vehicle routes, land and every live layer', 'Pins, routes, measuring, GPX export', 'Trail reports, guides and rider posts'];
const PRO = ['3D terrain', 'Offline maps, any area you choose', 'Crews: shared routes, pins and chat', 'Backup and sync between phone and web', 'GPX import', 'Submit trails and map fixes'];

export default function Landing() {
  const session = useApp((s) => s.session);
  const [exploring, setExploring] = useState(false);
  return (
    <div className="site">
      <header className="site-nav">
        <Link to="/" className="site-logo"><img src="/brand/cholla-logo-light-640w.png" srcSet="/brand/cholla-logo-light-640w.png 1x, /brand/cholla-logo-light-1280w.png 2x" alt="Cholla Maps" height="56" /></Link>
        <nav>
          <a href="#map">The map</a><a href="#layers">Layers</a><a href="#pro">Free and Pro</a>
          <Link className="btn primary" to="/map">{session ? 'Open the map' : 'Sign in'}</Link>
        </nav>
      </header>

      <section className={"hero" + (CAPTURE ? " capture" : "") + (exploring ? " exploring" : "")} id="map">
        <HeroMap onExplore={setExploring} />
        <div className="hero-scrim" aria-hidden="true" />
        <div className="hero-copy">
          <h1>Your map of the Mountain West.</h1>
          <p>Trails, Forest Service roads, land and live conditions in one 3D map. Plan on your computer. Ride from your phone.</p>
          <div className="hero-cta">
            <Link className="btn primary big" to="/map">Open the web map</Link>
            <a className="btn big ghost" href="https://apps.apple.com/" rel="noreferrer">Get the iPhone app</a>
          </div>
        </div>
        <div className="hero-caption">Drag to look around. Hold {MOD} and scroll to zoom.</div>
      </section>

      <section className="thesis">
        <div className="thesis-text">
          <h2>Every line carries its source and date.</h2>
          <p>Anyone can draw a trail. The question riders ask is whether the gate is open this weekend, whether bikes are allowed in October, whether that road is a road or a wash. Cholla answers with the agency record behind each line, the day it was retrieved, and what riders saw there last week.</p>
          <p>Trails outside their season turn grey and dotted for the activity you pick. Forest Service routes show what is legal by vehicle and by date. Click anything and the card tells you where the fact came from.</p>
        </div>
        <figure className="trailcard" aria-label="Example trail card">
          <div className="tc-kind">Trail</div>
          <div className="tc-title">Porcupine Rim</div>
          <div className="tc-uses"><span className="on">Hike</span><span className="on">Bike</span><span>Moto</span><span>ATV</span></div>
          <div className="tc-diff"><i /> Advanced, MTB rating</div>
          <dl className="tc-rows">
            <div><dt>Bikes</dt><dd>Open now, closes Nov 30</dd></div>
            <div><dt>Surface</dt><dd>Slickrock, ledges</dd></div>
            <div><dt>Length</dt><dd>14.6 mi</dd></div>
          </dl>
          <div className="tc-src">USFS NFS Trails, UGRC Trails and Pathways. Retrieved Oct 6, 2026</div>
          <div className="tc-cond"><i /> Good to go. Reported 3 days ago</div>
        </figure>
      </section>

      <section className="basemaps-strip">
        <div className="layers-intro">
          <h2>Three base maps, one set of trails.</h2>
          <p>Cholla’s own topo, a night version for the drive out, and satellite with contours and labels on top. All three carry 3D terrain and download for offline use.</p>
        </div>
        <div className="bm-grid">
          {BASEMAP_SHOTS.map((b) => (
            <figure key={b.label}>
              <img src={b.src} alt={`${b.label} base map of ${b.place}`} loading="lazy" width="800" height="560" />
              <figcaption><b>{b.label}</b><span>{b.place}</span></figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="steps">
        <h2>Plan here. Ride there.</h2>
        <ol>
          {STEPS.map(([h, p], i) => <li key={h}><span className="step-n">{i + 1}</span><h3>{h}</h3><p>{p}</p></li>)}
        </ol>
      </section>

      <section className="layers-list" id="layers">
        <div className="layers-intro">
          <h2>What is on the map</h2>
          <p>Each layer names where it comes from and how fresh it is. Live layers need a signal; the rest come with an offline download.</p>
        </div>
        <div className="layers-cols">
          {GROUPS.map((g) => (
            <div key={g.id} className="layer-group">
              <h3>{g.label}</h3>
              <ul>
                {LAYERS.filter((l) => l.group === g.id).map((l) => (
                  <li key={l.id}><b>{l.label}</b><span>{l.soon ? 'Coming' : l.source}{l.cadence ? `, ${l.cadence.toLowerCase()}` : ''}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="tiers" id="pro">
        <div className="tier">
          <h2>Free</h2>
          <p className="price">The map, with an account</p>
          <ul>{FREE.map((f) => <li key={f}>{f}</li>)}</ul>
          <Link className="btn" to="/sign-in">Create an account</Link>
        </div>
        <div className="tier pro">
          <h2>Cholla Pro</h2>
          <p className="price">$2.99 a month, or $19.99 a year</p>
          <ul>{PRO.map((f) => <li key={f}>{f}</li>)}</ul>
          <p className="tier-note">Subscribe in the iPhone app. Pro is on here the next time you sign in.</p>
        </div>
      </section>

      <footer className="site-foot">
        <div><img src="/brand/cholla-logo-640w.png" alt="Cholla" height="26" /><span>Made by High Desert Outdoors in Utah.</span></div>
        <nav><a href="https://highdesertoutdoor.co">highdesertoutdoor.co</a><a href="https://highdesertoutdoor.co/terms">Terms</a><a href="https://highdesertoutdoor.co/privacy">Privacy</a><a href="mailto:hello@chollamaps.com">Contact</a></nav>
      </footer>
    </div>
  );
}
