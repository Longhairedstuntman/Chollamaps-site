/* Everything drawn over the base style. Ported from the Phase 0 page
   (web/site/app.js) and the phone's AccessMapView, but reading the vector
   tilesets instead of GeoJSON files, so every state is on the map at flat
   memory. Re-run addAll() after every style switch — setStyle wipes it. */
import type { Activity, BaseId } from '../lib/config';
import { ACTIVITIES, BASES, CLOSED, DIFF, LAND, LAND_TILESET, LINES_TILESET, SUPABASE_URL, UNRATED } from '../lib/config';
import { todayMMDD } from '../lib/format';
import { sb } from '../lib/supabase';
import type { LayerId } from './layers';

type Expr = mapboxgl.ExpressionSpecification;
export interface ViewSpec { base: BaseId; activity: Activity; layers: Set<LayerId>; signedIn: boolean }

// ---------------------------------------------------------------- expressions

const width = (add = 0, scale = 1): Expr =>
  ['interpolate', ['linear'], ['zoom'], 9, 1.2 * scale + add, 13, 2.4 * scale + add, 16, 4 * scale + add];

function trailFilter(a: Activity): Expr {
  const dirt: Expr = ['==', ['get', 'kind'], 'trail'];
  switch (a) {
    case 'mtb': return ['all', ['to-boolean', ['get', 'bike']], dirt];
    case 'moto': case 'snowmobile': return ['to-boolean', ['get', 'moto']];
    case 'hike': return ['all', ['to-boolean', ['get', 'foot']], dirt];
    case 'ski': return ['all', ['to-boolean', ['get', 'foot']], dirt];   // approach trails; the terrain layers are the point
    default: return ['has', 'kind'];
  }
}

// True when the feature has `prefix` season dates and today is outside them.
function closedExpr(prefix: string): Expr {
  const t = todayMMDD(), o: Expr = ['get', prefix + '_open'], c: Expr = ['get', prefix + '_close'];
  const inside: Expr = ['case', ['<=', o, c], ['all', ['>=', t, o], ['<=', t, c]], ['any', ['>=', t, o], ['<=', t, c]]];
  return ['all', ['has', prefix + '_open'], ['!', inside]];
}

function trailClosed(a: Activity): Expr {
  switch (a) {
    case 'mtb': return closedExpr('bike');
    case 'moto': return closedExpr('moto');
    case 'hike': case 'ski': case 'snowmobile': return ['==', 1, 0];   // summer seasons don't apply over snow
    default:
      return ['all', ['any', ['has', 'bike_open'], ['has', 'moto_open']],
        ['any', ['!', ['has', 'bike_open']], closedExpr('bike')],
        ['any', ['!', ['has', 'moto_open']], closedExpr('moto')]];
  }
}
const mvumClosed = (a: Activity) => (a === 'snowmobile' ? (['==', 1, 0] as Expr) : closedExpr(a === 'moto' ? 'moto' : 'hc'));

function trailColor(a: Activity, night: boolean): Expr {
  if (a === 'moto' || a === 'hike' || a === 'ski' || a === 'snowmobile') return ACTIVITIES[a].color as unknown as Expr;
  const m: unknown[] = ['match', ['get', 'diff']], n = night ? 'night' : 'day';
  for (const k of Object.keys(DIFF)) m.push(k, DIFF[k][n]);
  m.push(UNRATED[n]);
  return m as Expr;
}

const landColor = (): Expr => {
  const m: unknown[] = ['match', ['get', 'agency']];
  for (const k of Object.keys(LAND)) m.push(k, LAND[k][1]);
  m.push('#C9C3B0');
  return m as Expr;
};

const firstSymbol = (map: mapboxgl.Map) => map.getStyle()?.layers?.find((l) => l.type === 'symbol')?.id;

// ---------------------------------------------------------------- core overlays

export function addAll(map: mapboxgl.Map, v: ViewSpec) {
  const before = firstSymbol(map);
  const night = v.base === 'night';
  const casing = BASES[v.base].casing;

  if (!map.getSource('land')) map.addSource('land', { type: 'vector', url: LAND_TILESET });
  if (!map.getSource('lines')) map.addSource('lines', { type: 'vector', url: LINES_TILESET });

  map.addLayer({ id: 'land-fill', type: 'fill', source: 'land', 'source-layer': 'land',
    paint: { 'fill-color': landColor(), 'fill-opacity': 0.18 } }, before);
  map.addLayer({ id: 'land-edge', type: 'line', source: 'land', 'source-layer': 'land',
    paint: { 'line-color': landColor(), 'line-opacity': 0.6, 'line-width': 1 } }, before);

  map.addLayer({ id: 'mvum-yearlong', type: 'line', source: 'lines', 'source-layer': 'mvum',
    filter: ['all', ['==', ['get', 'season'], 'yearlong'], ['!', mvumClosed(v.activity)]],
    layout: { 'line-cap': 'round' }, paint: { 'line-color': '#8C7A55', 'line-width': width(0, 0.3) } }, before);
  map.addLayer({ id: 'mvum-seasonal', type: 'line', source: 'lines', 'source-layer': 'mvum',
    filter: ['all', ['!=', ['get', 'season'], 'yearlong'], ['!', mvumClosed(v.activity)]],
    paint: { 'line-color': '#8C7A55', 'line-width': width(0, 0.3), 'line-dasharray': [2, 1.5] } }, before);
  map.addLayer({ id: 'mvum-closed', type: 'line', source: 'lines', 'source-layer': 'mvum', filter: mvumClosed(v.activity),
    paint: { 'line-color': CLOSED[night ? 'night' : 'day'], 'line-opacity': 0.8, 'line-width': width(0, 0.3), 'line-dasharray': [1, 2] } }, before);

  map.addLayer({ id: 'trails-casing', type: 'line', source: 'lines', 'source-layer': 'trails', filter: trailFilter(v.activity),
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': casing, 'line-opacity': 0.8, 'line-width': width(1.2, 0.8) } }, before);
  map.addLayer({ id: 'trails', type: 'line', source: 'lines', 'source-layer': 'trails',
    filter: ['all', trailFilter(v.activity), ['!', trailClosed(v.activity)]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': trailColor(v.activity, night), 'line-width': width(0, 0.8), 'line-opacity': v.activity === 'ski' ? 0.55 : 1 } }, before);
  map.addLayer({ id: 'trails-closed', type: 'line', source: 'lines', 'source-layer': 'trails',
    filter: ['all', trailFilter(v.activity), trailClosed(v.activity)],
    paint: { 'line-color': CLOSED[night ? 'night' : 'day'], 'line-width': width(0, 0.8), 'line-dasharray': [1, 2] } }, before);
  map.addLayer({ id: 'trails-label', type: 'symbol', source: 'lines', 'source-layer': 'trails', filter: trailFilter(v.activity), minzoom: 13,
    layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-size': 11 },
    paint: { 'text-color': ACTIVITIES[v.activity].color, 'text-halo-color': casing, 'text-halo-width': 1.4 } });

  // Your things and the tools' scratch layers (empty until used).
  const empty = { type: 'geojson' as const, data: { type: 'FeatureCollection' as const, features: [] } };
  for (const id of ['mine-lines', 'mine-pins', 'tool-line', 'tool-fill', 'tool-points', 'focus-line']) if (!map.getSource(id)) map.addSource(id, empty);
  map.addLayer({ id: 'mine-lines', type: 'line', source: 'mine-lines', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['coalesce', ['get', 'color'], '#C8662A'], 'line-width': 4, 'line-opacity': 0.9 } });
  map.addLayer({ id: 'focus-line', type: 'line', source: 'focus-line', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#C8662A', 'line-width': 6, 'line-opacity': 0.95 } });
  map.addLayer({ id: 'tool-fill', type: 'fill', source: 'tool-fill', paint: { 'fill-color': '#C8662A', 'fill-opacity': 0.18 } });
  map.addLayer({ id: 'tool-line', type: 'line', source: 'tool-line', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#C8662A', 'line-width': 4.5,
      'line-dasharray': ['case', ['==', ['get', 'mode'], 'blaze'], ['literal', [1.5, 1.2]], ['literal', [1, 0]]] } });
  map.addLayer({ id: 'tool-points', type: 'circle', source: 'tool-points',
    paint: { 'circle-radius': 7, 'circle-color': '#C8662A', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } });
  map.addLayer({ id: 'mine-pins', type: 'circle', source: 'mine-pins',
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 8], 'circle-color': ['coalesce', ['get', 'color'], '#C8662A'],
             'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
  map.addLayer({ id: 'mine-pins-label', type: 'symbol', source: 'mine-pins', minzoom: 11,
    layout: { 'text-field': ['get', 'title'], 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
    paint: { 'text-color': '#0E100E', 'text-halo-color': '#fff', 'text-halo-width': 1.4 } });

  applyView(map, v);
}

export function applyView(map: mapboxgl.Map, v: ViewSpec) {
  if (!map.getLayer('trails')) return;
  const vis = (on: boolean) => (on ? 'visible' : 'none');
  const night = v.base === 'night';
  const showTrails = v.layers.has('trails'), showMvum = v.layers.has('mvum'), showLand = v.layers.has('land');
  for (const id of ['trails', 'trails-closed', 'trails-casing', 'trails-label']) map.setLayoutProperty(id, 'visibility', vis(showTrails));
  for (const id of ['trails-casing', 'trails-label']) map.setFilter(id, trailFilter(v.activity));
  map.setFilter('trails', ['all', trailFilter(v.activity), ['!', trailClosed(v.activity)]]);
  map.setFilter('trails-closed', ['all', trailFilter(v.activity), trailClosed(v.activity)]);
  map.setPaintProperty('trails', 'line-color', trailColor(v.activity, night));
  map.setPaintProperty('trails', 'line-opacity', v.activity === 'ski' ? 0.55 : 1);
  map.setPaintProperty('trails-label', 'text-color', ACTIVITIES[v.activity].color);
  map.setFilter('mvum-yearlong', ['all', ['==', ['get', 'season'], 'yearlong'], ['!', mvumClosed(v.activity)]]);
  map.setFilter('mvum-seasonal', ['all', ['!=', ['get', 'season'], 'yearlong'], ['!', mvumClosed(v.activity)]]);
  map.setFilter('mvum-closed', mvumClosed(v.activity));
  for (const id of ['mvum-yearlong', 'mvum-seasonal', 'mvum-closed']) map.setLayoutProperty(id, 'visibility', vis(showMvum));
  for (const id of ['land-fill', 'land-edge']) map.setLayoutProperty(id, 'visibility', vis(showLand));
}

// ---------------------------------------------------------------- live layers

const arcgis = (service: string, layers?: string) =>
  `${service}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&format=png32&transparent=true&dpi=192&f=image` + (layers ? `&layers=show:${layers}` : '');

/** Slope angle in avalanche bands, computed server-side by USGS 3DEP: slope in
    degrees (scaled for a geographic DEM) → remapped to a band → colored. Below
    25° is NoData, so the ground shows through. Same bands as SLOPE_BANDS in layers.ts. */
export const SLOPE_RULE = {
  rasterFunction: 'Colormap',
  rasterFunctionArguments: {
    Colormap: [[2, 255, 242, 0], [3, 247, 147, 30], [4, 239, 28, 41], [5, 146, 39, 143], [6, 0, 113, 188]],
    Raster: {
      rasterFunction: 'Remap',
      rasterFunctionArguments: {
        InputRanges: [25, 30, 30, 35, 35, 40, 40, 45, 45, 90], OutputValues: [2, 3, 4, 5, 6], NoDataRanges: [0, 25], AllowUnmatched: false,
        Raster: { rasterFunction: 'Slope', rasterFunctionArguments: { SlopeType: 3, ZFactor: 1, PSPower: 0.664, PSZFactor: 0.024, RemoveEdgeEffect: false } }
      }
    }
  }
};

const LIVE = {
  radar: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',
  fires: 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query'
    + '?where=1%3D1&outFields=poly_IncidentName,attr_PercentContained,poly_GISAcres&geometry=-120,35,-102,50&geometryType=esriGeometryEnvelope&inSR=4326'
    + '&spatialRel=esriSpatialRelIntersects&outSR=4326&geometryPrecision=5&maxAllowableOffset=0.0005&f=geojson',
  // Today's danger by zone for UT/ID/WY/MT/CO (supabase/functions/avalanche merges
  // avalanche.org with CAIC's live Colorado areas and adds CORS). The bundled zone
  // outlines are the fallback when it is unreachable.
  avalanche: `${SUPABASE_URL}/functions/v1/avalanche`,
  avalancheFallback: '/data/cholla-avalanche-zones.geojson',
  forestWilderness: arcgis('https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_Wilderness_01/MapServer'),
  blmWilderness: arcgis('https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_NLCS_WLD_WSA/MapServer'),
  roadless: arcgis('https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_InventoriedRoadlessAreas2001_01/MapServer'),
  burns: arcgis('https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_MTBS_01/MapServer', '63'),
  slope: 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage'
    + '?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=512,512&format=png32&transparent=true&f=image&renderingRule=' + encodeURIComponent(JSON.stringify(SLOPE_RULE)),
  blmLand: 'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_BLM_Only/MapServer/tile/{z}/{y}/{x}',
  campgrounds: 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_RecreationOpportunities_01/MapServer/0/query'
    + '?where=markeractivitygroup%3D%27Camping%20%26%20Cabins%27&outFields=recareaname,markeractivity,openstatus,forestname'
    + '&geometry=-117.5,36.5,-103.5,49.2&geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326&resultRecordCount=2000&f=geojson',
  plss: arcgis('https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer', '1,2'),
  snotelStations: 'https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations?networkCds=SNTL&activeOnly=true&returnForecastPointMetadata=false&returnReservoirMetadata=false&returnStationElements=false'
};

const raster = (map: mapboxgl.Map, id: string, tiles: string[], opacity: number, minzoom = 0, before?: string, tileSize = 512) => {
  if (map.getSource(id)) return;
  map.addSource(id, { type: 'raster', tiles, tileSize, minzoom });
  map.addLayer({ id, type: 'raster', source: id, minzoom, paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0 } }, before);
};
const geo = (map: mapboxgl.Map, id: string, data: string | GeoJSON.GeoJSON) => {
  if (map.getSource(id)) (map.getSource(id) as mapboxgl.GeoJSONSource).setData(data as GeoJSON.GeoJSON);
  else map.addSource(id, { type: 'geojson', data });
};
const removeAll = (map: mapboxgl.Map, ids: string[], sources: string[]) => {
  for (const id of ids) if (map.getLayer(id)) map.removeLayer(id);
  for (const s of sources) if (map.getSource(s)) map.removeSource(s);
};

const radarTimers = new WeakMap<mapboxgl.Map, number>();

/** Turn one live layer on or off. Safe to call again after a style switch. */
export async function setLive(map: mapboxgl.Map, id: LayerId, on: boolean, signedIn: boolean, night = false) {
  const before = map.getLayer('mvum-yearlong') ? 'mvum-yearlong' : undefined;
  const beforeLand = map.getLayer('land-fill') ? 'land-fill' : before;
  switch (id) {
    case 'radar': {
      if (!on) { removeAll(map, ['radar'], ['radar']); clearInterval(radarTimers.get(map)); return; }
      raster(map, 'radar', [LIVE.radar], 0.7, 0, firstSymbol(map), 256);
      clearInterval(radarTimers.get(map));
      radarTimers.set(map, window.setInterval(() => {
        if (!map.getSource('radar')) return;
        (map.getSource('radar') as mapboxgl.RasterTileSource).setTiles?.([LIVE.radar + '?t=' + Date.now()]);
      }, 5 * 60 * 1000));
      return;
    }
    case 'fires': {
      if (!on) return removeAll(map, ['fires-fill', 'fires-edge'], ['fires']);
      geo(map, 'fires', LIVE.fires);
      if (!map.getLayer('fires-fill')) {
        map.addLayer({ id: 'fires-fill', type: 'fill', source: 'fires', paint: { 'fill-color': '#C8402E', 'fill-opacity': 0.35 } }, before);
        map.addLayer({ id: 'fires-edge', type: 'line', source: 'fires', paint: { 'line-color': '#C8402E', 'line-width': 1.5 } }, before);
      }
      return;
    }
    case 'burns': return on ? raster(map, 'burns', [LIVE.burns], 0.45, 7, before) : removeAll(map, ['burns'], ['burns']);
    case 'wilderness': {
      if (!on) return removeAll(map, ['wild-fs', 'wild-blm'], ['wild-fs', 'wild-blm']);
      raster(map, 'wild-fs', [LIVE.forestWilderness], 0.5, 6, beforeLand);
      raster(map, 'wild-blm', [LIVE.blmWilderness], 0.5, 6, beforeLand);
      return;
    }
    case 'roadless': return on ? raster(map, 'roadless', [LIVE.roadless], 0.45, 6, beforeLand) : removeAll(map, ['roadless'], ['roadless']);
    case 'plss': return on ? raster(map, 'plss', [LIVE.plss], 0.75, 9, firstSymbol(map)) : removeAll(map, ['plss'], ['plss']);
    case 'slope': return on ? raster(map, 'slope', [LIVE.slope], 0.55, 10, beforeLand) : removeAll(map, ['slope'], ['slope']);
    case 'avalanche': {
      if (!on) return removeAll(map, ['avy-fill', 'avy-edge', 'avy-label'], ['avy']);
      geo(map, 'avy', await avalancheZones());
      if (!map.getLayer('avy-fill')) {
        map.addLayer({ id: 'avy-fill', type: 'fill', source: 'avy', paint: { 'fill-color': ['coalesce', ['get', 'color'], '#CCCCCC'], 'fill-opacity': 0.35 } }, beforeLand);
        map.addLayer({ id: 'avy-edge', type: 'line', source: 'avy', paint: { 'line-color': ['coalesce', ['get', 'color'], '#999'], 'line-width': 1.2 } }, beforeLand);
        map.addLayer({ id: 'avy-label', type: 'symbol', source: 'avy', minzoom: 7,
          layout: { 'text-field': ['concat', ['get', 'name'], '\n', ['upcase', ['coalesce', ['get', 'danger'], '']]],
                    'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-size': 11, 'text-max-width': 12 },
          paint: { 'text-color': night ? '#F3F1E8' : '#0E100E', 'text-halo-color': night ? '#0A0C0A' : '#F6F5EF', 'text-halo-width': 1.4 } });
      }
      return;
    }
    case 'snotel': {
      if (!on) return removeAll(map, ['snotel', 'snotel-label'], ['snotel']);
      let fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
      try {
        const r = await fetch(LIVE.snotelStations);
        const rows = (await r.json()) as Array<{ stationTriplet: string; name: string; latitude: number; longitude: number; elevation?: number }>;
        fc = { type: 'FeatureCollection', features: rows.filter((s) => s.longitude < -102 && s.longitude > -120 && s.latitude > 35).map((s) => ({
          type: 'Feature', geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
          properties: { triplet: s.stationTriplet, name: s.name, elevation_ft: s.elevation } })) };
      } catch { /* leave empty */ }
      geo(map, 'snotel', fc);
      if (!map.getLayer('snotel')) {
        map.addLayer({ id: 'snotel', type: 'circle', source: 'snotel', paint: { 'circle-radius': 5, 'circle-color': '#3C7FC4', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
        map.addLayer({ id: 'snotel-label', type: 'symbol', source: 'snotel', minzoom: 9,
          layout: { 'text-field': ['get', 'name'], 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-size': 10, 'text-offset': [0, 1], 'text-anchor': 'top' },
          paint: { 'text-color': '#2F6E8A', 'text-halo-color': '#fff', 'text-halo-width': 1.2 } });
      }
      return;
    }
    case 'trailheads': {
      if (!on) return removeAll(map, ['trailheads', 'trailheads-label'], ['trailheads']);
      const { data } = await sb.rpc('trailheads_geojson');
      geo(map, 'trailheads', (data as GeoJSON.GeoJSON) || { type: 'FeatureCollection', features: [] });
      if (!map.getLayer('trailheads')) {
        map.addLayer({ id: 'trailheads', type: 'circle', source: 'trailheads', minzoom: 9,
          paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 7], 'circle-color': '#2F6E8A', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
        map.addLayer({ id: 'trailheads-label', type: 'symbol', source: 'trailheads', minzoom: 12,
          layout: { 'text-field': ['coalesce', ['get', 'name'], ['get', 'title'], 'Trailhead'], 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-size': 10, 'text-offset': [0, 1], 'text-anchor': 'top' },
          paint: { 'text-color': '#2F6E8A', 'text-halo-color': '#fff', 'text-halo-width': 1.2 } });
      }
      return;
    }
    case 'camping': {
      if (!on) return removeAll(map, ['blm-camp', 'campgrounds', 'campsites'], ['blm-camp', 'campgrounds', 'campsites']);
      raster(map, 'blm-camp', [LIVE.blmLand], 0.25, 5, beforeLand, 256);
      geo(map, 'campgrounds', LIVE.campgrounds);
      if (!map.getLayer('campgrounds')) map.addLayer({ id: 'campgrounds', type: 'circle', source: 'campgrounds', minzoom: 8,
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 7], 'circle-color': '#3E8659', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
      const { data } = await sb.rpc('campsites_geojson');
      geo(map, 'campsites', (data as GeoJSON.GeoJSON) || { type: 'FeatureCollection', features: [] });
      if (!map.getLayer('campsites')) map.addLayer({ id: 'campsites', type: 'circle', source: 'campsites', minzoom: 8,
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 7], 'circle-color': '#B87514', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
      return;
    }
    case 'conditions': {
      const ids = ['cond-closed', 'cond-muddy', 'cond-downed_trees', 'cond-good'];
      if (!on || !signedIn || !map.getLayer('trails')) return removeAll(map, ids, []);
      const { data } = await sb.rpc('trail_conditions_map');
      const rows = (data as Array<{ trail_key: string; status: string }>) || [];
      const groups: Array<[string[], string]> = [[['closed'], '#C8402E'], [['muddy', 'snow'], '#3C7FC4'], [['downed_trees', 'washed_out'], '#E08A1E'], [['good', 'dusty'], '#3E9B5A']];
      for (const [sts, color] of groups) {
        const id = 'cond-' + sts[0], keys = rows.filter((d) => sts.includes(d.status)).map((d) => d.trail_key);
        if (map.getLayer(id)) map.removeLayer(id);
        if (!keys.length) continue;
        map.addLayer({ id, type: 'line', source: 'lines', 'source-layer': 'trails', filter: ['in', ['get', 'tid'], ['literal', keys]],
          paint: { 'line-color': color, 'line-width': 9, 'line-opacity': 0.5, 'line-blur': 1.5 } }, 'trails');
      }
      return;
    }
    default: return;
  }
}

/** Layers you can click, in priority order, and the kind of card they open. */
export const TAPPABLE: Array<[string, string]> = [
  ['mine-pins', 'pin'], ['tool-points', 'tool'],
  ['trails', 'trail'], ['trails-closed', 'trail'], ['trailheads', 'trailhead'], ['campsites', 'campsite'], ['campgrounds', 'campground'],
  ['snotel', 'snotel'], ['mvum-yearlong', 'mvum'], ['mvum-seasonal', 'mvum'], ['mvum-closed', 'mvum'],
  ['fires-fill', 'fire'], ['avy-fill', 'avalanche'], ['land-fill', 'land']
];

// ---------------------------------------------------------------- avalanche zones

/** Today's danger by zone from the edge function; if that fails, the bundled
    outlines with no rating, so the zones (and their forecast links) still show. */
export async function avalancheZones(): Promise<GeoJSON.FeatureCollection> {
  try {
    const r = await fetch(LIVE.avalanche);
    if (r.ok) return (await r.json()) as GeoJSON.FeatureCollection;
  } catch { /* fall through */ }
  try {
    const r = await fetch(LIVE.avalancheFallback);
    const fc = (await r.json()) as GeoJSON.FeatureCollection;
    for (const f of fc.features) Object.assign(f.properties!, { danger: 'no rating', danger_level: -1, color: '#CCCCCC', offline: true });
    return fc;
  } catch { return { type: 'FeatureCollection', features: [] }; }
}

// ---------------------------------------------------------------- SNOTEL latest reading

export async function snotelLatest(triplet: string): Promise<{ depth_in?: number; swe_in?: number; date?: string } | null> {
  const end = new Date(), begin = new Date(Date.now() - 7 * 86400000);
  const f = (d: Date) => d.toISOString().slice(0, 10);
  const url = `https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data?stationTriplets=${encodeURIComponent(triplet)}&elements=SNWD,WTEQ&duration=DAILY&beginDate=${f(begin)}&endDate=${f(end)}&periodRef=END`;
  try {
    const r = await fetch(url); if (!r.ok) return null;
    const j = (await r.json()) as Array<{ data: Array<{ stationElement: { elementCode: string }; values: Array<{ date: string; value: number }> }> }>;
    const out: { depth_in?: number; swe_in?: number; date?: string } = {};
    for (const d of j[0]?.data || []) {
      const last = [...d.values].reverse().find((v) => v.value != null);
      if (!last) continue;
      if (d.stationElement.elementCode === 'SNWD') out.depth_in = last.value;
      if (d.stationElement.elementCode === 'WTEQ') out.swe_in = last.value;
      out.date = last.date;
    }
    return out;
  } catch { return null; }
}
