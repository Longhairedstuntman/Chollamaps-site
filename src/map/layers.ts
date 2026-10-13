/* The layer catalog: what the Layers panel offers, grouped the way onX groups
   them, with the source and cadence shown in each layer's Details. The map
   logic for each lives in overlays.ts. Live layers need a connection and are
   not part of the phone's offline downloads. */

export type LayerGroup = 'cholla' | 'conditions' | 'land' | 'snow' | 'comms';
export const GROUPS: Array<{ id: LayerGroup; label: string }> = [
  { id: 'cholla', label: 'Trails & routes' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'land', label: 'Land & access' },
  { id: 'snow', label: 'Snow & terrain' },
  { id: 'comms', label: 'Communication' }
];

export type LayerId =
  | 'trails' | 'mvum' | 'conditions' | 'trailheads' | 'camping'
  | 'radar' | 'fires' | 'burns'
  | 'land' | 'wilderness' | 'roadless' | 'plss'
  | 'avalanche' | 'slope' | 'snotel'
  | 'cell';

export interface LayerDef {
  id: LayerId;
  group: LayerGroup;
  label: string;
  source: string;          // one line under the label
  details: string;         // the Details card
  cadence?: string;        // how fresh it is
  legend?: Array<{ swatch: string; label: string; kind?: 'line' | 'dashed' | 'fill' | 'dot' }>;
  live?: boolean;          // needs a connection, not in offline downloads
  minzoom?: number;        // "zoom in to see this"
  signIn?: boolean;        // needs an account (rider-reported data)
  soon?: boolean;          // listed, not built yet
}

/** Slope-angle bands (degrees). Same colors onX and CalTopo users expect; the
    raster rule in overlays.ts (SLOPE_RULE) must match. */
export const SLOPE_BANDS = [
  { from: 25, to: 30, color: '#FFF200', label: '25–30°' },
  { from: 30, to: 35, color: '#F7931E', label: '30–35°' },
  { from: 35, to: 40, color: '#EF1C29', label: '35–40°' },
  { from: 40, to: 45, color: '#92278F', label: '40–45°' },
  { from: 45, to: 90, color: '#0071BC', label: '45°+' }
];

export const LAYERS: LayerDef[] = [
  { id: 'trails', group: 'cholla', label: 'Trails', source: 'USFS · UGRC · OpenStreetMap',
    details: 'Trails for the activity you picked, colored by mountain-bike difficulty when the agency rated them. Trails outside their season turn grey and dotted. Click one for its source, date and conditions.',
    legend: [{ swatch: '#2E8B57', label: 'Easy', kind: 'line' }, { swatch: '#2C6FBF', label: 'Intermediate', kind: 'line' }, { swatch: '#1F1F1F', label: 'Advanced', kind: 'line' },
             { swatch: '#C23B2E', label: 'Expert', kind: 'line' }, { swatch: '#8A8F7A', label: 'Not rated', kind: 'line' }, { swatch: '#A39E92', label: 'Closed today', kind: 'dashed' }] },
  { id: 'mvum', group: 'cholla', label: 'Forest Service vehicle routes', source: 'USFS Motor Vehicle Use Map',
    details: 'Where motor vehicles are legal in National Forests, by vehicle type and season. This is the legal map, not a condition report — a legal road can still be washed out.',
    legend: [{ swatch: '#8C7A55', label: 'Open year-round', kind: 'line' }, { swatch: '#8C7A55', label: 'Seasonal', kind: 'dashed' }, { swatch: '#A39E92', label: 'Closed today', kind: 'dashed' }] },
  { id: 'conditions', group: 'cholla', label: 'Trail conditions', source: 'Cholla riders · last 14 days', signIn: true,
    details: 'A glow on trails that riders reported in the last two weeks: green good, orange obstacles, blue mud or snow, red closed. Open the trail to read the reports and add your own.',
    legend: [{ swatch: '#3E9B5A', label: 'Good to go' }, { swatch: '#E08A1E', label: 'Downed trees · washed out' }, { swatch: '#3C7FC4', label: 'Muddy · snow' }, { swatch: '#C8402E', label: 'Closed' }] },
  { id: 'trailheads', group: 'cholla', label: 'Trailheads', source: 'OpenStreetMap · Cholla riders', minzoom: 9,
    details: 'Trailheads and staging areas. Click one for parking and the trails that start there.', legend: [{ swatch: '#2F6E8A', label: 'Trailhead', kind: 'dot' }] },
  { id: 'camping', group: 'cholla', label: 'Camping', source: 'BLM · USFS Recreation Portal · Cholla riders', live: true,
    details: 'Campgrounds and camping areas, plus BLM land shaded where dispersed camping is generally allowed up to 14 days unless posted. Paid sites link to reservations (Pro).',
    legend: [{ swatch: '#3E8659', label: 'Campground', kind: 'dot' }, { swatch: '#B87514', label: 'Dispersed site', kind: 'dot' }, { swatch: 'rgba(217,196,138,.5)', label: 'BLM land', kind: 'fill' }] },

  { id: 'radar', group: 'conditions', label: 'Radar', source: 'NOAA NEXRAD via Iowa Environmental Mesonet', cadence: 'Every 5 minutes', live: true,
    details: 'Composite precipitation radar for the lower 48. Reloads every five minutes while it is on.' },
  { id: 'fires', group: 'conditions', label: 'Active wildfires', source: 'NIFC WFIGS current perimeters', cadence: 'Near real time', live: true,
    details: 'Perimeters of fires currently being managed, with the incident name and percent contained. Closures around a fire are set by the agency — check InciWeb before you go.',
    legend: [{ swatch: 'rgba(200,64,46,.45)', label: 'Current perimeter', kind: 'fill' }] },
  { id: 'burns', group: 'conditions', label: 'Past burn areas', source: 'MTBS (USFS)', cadence: 'Large fires since 1984', live: true,
    details: 'Burned-area boundaries from the Monitoring Trends in Burn Severity program. Burned slopes mean dead trees across trails, flash-flood washes and loose soil for years after.' },

  { id: 'land', group: 'land', label: 'Land ownership', source: 'BLM Surface Management Agency',
    details: 'Who manages the ground: BLM, National Forest, National Park Service, state, tribal and private. Boundaries are generalized — check signs on the ground before you camp or cross.',
    legend: [{ swatch: '#D9C48A', label: 'BLM', kind: 'fill' }, { swatch: '#A9B99A', label: 'National Forest', kind: 'fill' }, { swatch: '#B9A9C9', label: 'National Park', kind: 'fill' },
             { swatch: '#9FB3C4', label: 'State', kind: 'fill' }, { swatch: '#C4A9A0', label: 'Tribal', kind: 'fill' }, { swatch: '#E6E3D6', label: 'Private', kind: 'fill' }] },
  { id: 'wilderness', group: 'land', label: 'Wilderness & study areas', source: 'USFS Wilderness · BLM Wilderness and WSAs', live: true,
    details: 'Designated wilderness and wilderness study areas. No bikes or motors inside; foot and horse only.' },
  { id: 'roadless', group: 'land', label: 'Roadless areas', source: 'USFS Inventoried Roadless Areas (2001)', live: true,
    details: 'National Forest areas managed without new road building. Trails may still be open to bikes and motos — check the MVUM layer.' },
  { id: 'plss', group: 'land', label: 'Township · range · section', source: 'BLM CadNSDI PLSS', live: true, minzoom: 9,
    details: 'The Public Land Survey grid, for matching agency maps and legal descriptions. Shows from zoom 9.' },

  { id: 'avalanche', group: 'snow', label: 'Avalanche forecast', source: 'avalanche.org · UAC · SNFAC · PAC · IPAC · BTAC · GNFAC · FAC · WCMAC · CAIC', cadence: 'Daily in season', live: true,
    details: 'Forecast zones for Utah, Idaho, Wyoming, Montana and Colorado, colored by today’s overall danger. Grey means no rating today (off season or early season). Colorado’s areas come straight from CAIC and can change day to day. Click a zone for the center’s full forecast — the rating here is the day’s highest elevation band; always read the forecast before you go.',
    legend: [{ swatch: '#50B848', label: 'Low', kind: 'fill' }, { swatch: '#FFF200', label: 'Moderate', kind: 'fill' }, { swatch: '#F7931E', label: 'Considerable', kind: 'fill' },
             { swatch: '#EF1C29', label: 'High', kind: 'fill' }, { swatch: '#231F20', label: 'Extreme', kind: 'fill' }, { swatch: '#CCCCCC', label: 'No rating', kind: 'fill' }] },
  { id: 'slope', group: 'snow', label: 'Slope angle', source: 'USGS 3DEP elevation', live: true, minzoom: 10,
    details: 'Slope steepness in the bands avalanche forecasters use. Most avalanches start on slopes between 30° and 45°; shading begins at 25° so the ground stays readable below that. Computed from the 1/3-arc-second national elevation model, so it misses small features — treat it as a guide, not a measurement. Shows from zoom 10.',
    legend: SLOPE_BANDS.map((b) => ({ swatch: b.color, label: b.label, kind: 'fill' as const })) },
  { id: 'snotel', group: 'snow', label: 'Snow depth (SNOTEL)', source: 'NRCS SNOTEL stations', cadence: 'Daily', live: true,
    details: 'Automated snow stations across the western states. Click one for the latest snow depth and water equivalent.', legend: [{ swatch: '#3C7FC4', label: 'SNOTEL station', kind: 'dot' }] },

  { id: 'cell', group: 'comms', label: 'Cell coverage', source: 'FCC National Broadband Map', soon: true,
    details: 'Coverage by carrier. The FCC publishes it per carrier as large files that have to be processed into a map layer — it is on the build board.' }
];

export const layerById = (id: LayerId) => LAYERS.find((l) => l.id === id)!;
export const DEFAULT_ON: LayerId[] = ['trails', 'mvum', 'trailheads'];
