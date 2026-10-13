/* Shared constants. Same tokens, styles and tilesets as the phone app
   (Cholla/Cholla/Map/MapConfig.swift) and the old Phase 0 page. */

export const SUPABASE_URL = 'https://qddmsavyisjojdrhvavm.supabase.co';
// Publishable key — meant to ship in apps; row-level security protects the data.
export const SUPABASE_KEY = 'sb_publishable_-8yFixaTcgZXrvZfOqnmpw__NqUAW57';
// Public token, URL-restricted in the Mapbox console. Add chollamaps.com
// (and http://localhost:8000 for development) to its allowed URLs.
export const MAPBOX_TOKEN = 'pk.eyJ1IjoiYmNtYXBzNSIsImEiOiJjbXV0Ym9vNTAwdWZwMndwcDRzN21xcmNvIn0.kzpzIA81BXDHE7r8XWlu5A';

export type BaseId = 'topo' | 'night' | 'sat';
export const BASES: Record<BaseId, { label: string; url: string; casing: string; blurb: string }> = {
  topo:  { label: 'Topo',      url: 'mapbox://styles/bcmaps5/cmuu3gvmd00cu01ss75794num', casing: '#F6F5EF', blurb: 'Contours, peaks, roads and water' },
  night: { label: 'Night',     url: 'mapbox://styles/bcmaps5/cmuu3nkm500cv01ssc7g1di5y', casing: '#0A0C0A', blurb: 'The topo map, easy on the eyes after dark' },
  sat:   { label: 'Satellite', url: 'mapbox://styles/bcmaps5/cmuu3r7ce00aw01r7c3o1a4ry', casing: '#0E100E', blurb: 'Imagery with contours and labels on top' }
};

export type Activity = 'mtb' | 'moto' | 'hike' | 'ski' | 'snowmobile' | 'all';
export const ACTIVITIES: Record<Activity, { label: string; color: string; blurb: string }> = {
  mtb:  { label: 'MTB',       color: '#3E8659', blurb: 'Dirt trails open to bikes, colored by difficulty' },
  moto: { label: 'Dirt bike', color: '#7A5230', blurb: 'Routes open to motorcycles, with the Forest Service MVUM and land ownership' },
  hike: { label: 'Hike',      color: '#2F6E8A', blurb: 'Dirt trails open to foot traffic' },
  // Backcountry skiing is terrain-first, not trail-first: approach trails stay on as
  // a quiet foot network and the snow layers (avalanche, slope angle, SNOTEL) come on.
  ski:  { label: 'Ski',       color: '#4A6FA5', blurb: 'Backcountry skiing: avalanche forecast, slope angle and SNOTEL on, trails as approaches' },
  // Motorized routes as the network. The MVUM is the summer legal map — winter over-snow
  // rules differ by forest (OSVUM), so land ownership stays on to show whose ground it is.
  snowmobile: { label: 'Sled', color: '#2F8F8A', blurb: 'Snowmobiling: motorized routes and land ownership, with avalanche forecast, slope angle and SNOTEL on' },
  all:  { label: 'All',       color: '#3E8659', blurb: 'Every trail and motorized route' }
};
/** Layers an activity brings with it when picked (never removed when leaving). */
export const ACTIVITY_LAYERS: Partial<Record<Activity, string[]>> = {
  moto: ['mvum', 'land'], all: ['mvum'], ski: ['avalanche', 'slope', 'snotel'], snowmobile: ['mvum', 'land', 'avalanche', 'slope', 'snotel']
};

// Mountain bike difficulty (map/data/enrich_overlays.py `diff`).
export const DIFF: Record<string, { label: string; day: string; night: string }> = {
  easy:         { label: 'Easy',         day: '#2E8B57', night: '#5BC27E' },
  intermediate: { label: 'Intermediate', day: '#2C6FBF', night: '#5B9BE6' },
  advanced:     { label: 'Advanced',     day: '#1F1F1F', night: '#E8E6DD' },
  expert:       { label: 'Expert',       day: '#C23B2E', night: '#F0705C' }
};
export const UNRATED = { day: '#8A8F7A', night: '#7C8275' };
export const CLOSED = { day: '#A39E92', night: '#5A5C55' };

export const LAND: Record<string, [string, string]> = {
  BLM: ['Bureau of Land Management', '#D9C48A'], USFS: ['National Forest', '#A9B99A'],
  NPS: ['National Park Service', '#B9A9C9'], STATE: ['State land', '#9FB3C4'],
  TRIBAL: ['Tribal land', '#C4A9A0'], PRIVATE: ['Private land', '#E6E3D6']
};

export const LINES_TILESET = 'mapbox://bcmaps5.cholla-lines';   // source layers: trails, mvum
export const LAND_TILESET = 'mapbox://bcmaps5.cholla-land';     // source layer: land

export const CONDITIONS: Record<string, [string, string]> = {
  good: ['Good to go', '#3E9B5A'], dusty: ['Dry and loose', '#B8862F'], muddy: ['Muddy', '#7A5230'],
  snow: ['Snow', '#3C7FC4'], downed_trees: ['Downed trees', '#E08A1E'], washed_out: ['Washed out', '#E08A1E'],
  closed: ['Closed', '#C8402E']
};

export const PIN_KINDS: Record<string, { label: string; color: string }> = {
  pin: { label: 'Pin', color: '#C8662A' }, camp: { label: 'Camp', color: '#3E8659' }, water: { label: 'Water', color: '#2F6E8A' },
  hazard: { label: 'Hazard', color: '#A8432F' }, parking: { label: 'Parking', color: '#5E6B62' }, meet: { label: 'Meet here', color: '#B87514' }
};

// Same areas as map/data/build_overlays.mjs: [west, south, east, north]
export const AREAS: Array<[string, [number, number, number, number]]> = [
  ['Moab & La Sals', [-109.95, 38.30, -109.10, 38.85]],
  ['St. George, Hurricane & Gooseberry', [-113.95, 36.98, -112.95, 37.45]],
  ['Brian Head & Cedar City', [-113.20, 37.50, -112.65, 37.85]],
  ['Salt Lake & Wasatch Front', [-112.15, 40.40, -111.55, 40.95]],
  ['Park City & Heber', [-111.55, 40.40, -111.25, 40.82]],
  ['Provo & Utah County', [-111.90, 39.95, -111.45, 40.40]],
  ['Ogden Valley', [-112.05, 41.05, -111.65, 41.40]],
  ['Logan Canyon', [-111.85, 41.65, -111.40, 41.95]],
  ['San Rafael Swell', [-111.10, 38.70, -110.40, 39.25]],
  ['Little Sahara', [-112.50, 39.60, -112.20, 39.85]]
];
export const MOUNTAIN_WEST: [[number, number], [number, number]] = [[-117.3, 36.9], [-104.0, 49.0]];
export const DEFAULT_VIEW = { lat: 39.5, lon: -111.5, zoom: 6.2 };
