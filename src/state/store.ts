import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { ACTIVITY_LAYERS, type Activity, type BaseId } from '../lib/config';
import type { LngLat } from '../lib/geo';
import { DEFAULT_ON, type LayerId } from '../map/layers';

export type PanelId = 'search' | 'mine' | 'explore' | 'offline' | 'layers' | 'account' | 'weather' | null;
export type ToolId = 'pin' | 'measure' | 'area' | 'route' | null;

export interface Profile { id: string; display_name: string | null; username: string | null; role: string; units: 'imperial' | 'metric' }
export interface Info { kind: string; props: Record<string, unknown>; lngLat: LngLat }

export interface RouteRow { client_id: string; name: string; distance_m: number; ascent_m: number; descent_m: number; legs: Array<{ mode: string; points: LngLat[] }>; folder: string | null; created_at: string; updated_at: string; deleted: boolean }
export interface RideRow { client_id: string; activity_type: string; title: string | null; started_at: string; ended_at: string; distance_m: number; elevation_gain_m: number; moving_s: number; folder: string | null; track: number[][] | null; updated_at: string; deleted: boolean }
export interface PinRow { client_id: string; kind: string; title: string; note: string | null; lon: number; lat: number; folder: string | null; photo_path: string | null; created_at: string; updated_at: string; deleted: boolean }

const persisted = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem('cholla.' + key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const persist = (key: string, value: unknown) => { try { localStorage.setItem('cholla.' + key, JSON.stringify(value)); } catch { /* ignore */ } };

interface State {
  // account
  session: Session | null; profile: Profile | null; pro: boolean; authReady: boolean;
  setSession: (s: Session | null) => void; setProfile: (p: Profile | null, pro: boolean) => void;
  // view
  base: BaseId; activity: Activity; tilted: boolean; layers: Set<LayerId>;
  setBase: (b: BaseId) => void; setActivity: (a: Activity) => void; setTilted: (t: boolean) => void;
  toggleLayer: (id: LayerId, on?: boolean) => void; setLayers: (ids: LayerId[]) => void;
  // ui
  panel: PanelId; tool: ToolId; info: Info | null; toast: string | null; layerDetail: LayerId | null; weatherAt: LngLat | null; routeSeed: LngLat | null;
  setPanel: (p: PanelId) => void; setTool: (t: ToolId) => void; setInfo: (i: Info | null) => void;
  showToast: (t: string | null) => void; setLayerDetail: (id: LayerId | null) => void;
  openWeather: (at: LngLat | null) => void; startRouteAt: (at: LngLat | null) => void;
  // my content
  routes: RouteRow[]; rides: RideRow[]; pins: PinRow[]; contentLoaded: boolean; hidden: Set<string>; mapFilter: boolean;
  setContent: (c: { routes: RouteRow[]; rides: RideRow[]; pins: PinRow[] }) => void;
  toggleHidden: (key: string, on?: boolean) => void; setMapFilter: (on: boolean) => void;
}

let toastTimer = 0;

export const useApp = create<State>((set, get) => ({
  session: null, profile: null, pro: false, authReady: false,
  setSession: (session) => set({ session, authReady: true }),
  setProfile: (profile, pro) => set({ profile, pro }),

  base: persisted<BaseId>('base', 'topo'), activity: persisted<Activity>('activity', 'all'), tilted: persisted('tilted', false),
  layers: new Set<LayerId>(persisted<LayerId[]>('layers', DEFAULT_ON)),
  setBase: (base) => { persist('base', base); set({ base }); },
  setActivity: (activity) => {
    persist('activity', activity);
    const layers = new Set(get().layers);
    for (const id of ACTIVITY_LAYERS[activity] || []) layers.add(id as LayerId);   // Dirt bike brings the MVUM, Ski brings the snow layers.
    persist('layers', [...layers]);
    set({ activity, layers });
  },
  setTilted: (tilted) => { persist('tilted', tilted); set({ tilted }); },
  toggleLayer: (id, on) => {
    const layers = new Set(get().layers);
    const next = on ?? !layers.has(id);
    if (next) layers.add(id); else layers.delete(id);
    persist('layers', [...layers]);
    set({ layers });
  },
  setLayers: (ids) => { persist('layers', ids); set({ layers: new Set(ids) }); },

  panel: null, tool: null, info: null, toast: null, layerDetail: null, weatherAt: null, routeSeed: null,
  setPanel: (panel) => set((s) => ({ panel: s.panel === panel ? null : panel, layerDetail: null })),
  setTool: (tool) => set((s) => ({ tool: s.tool === tool ? null : tool, info: null })),
  setInfo: (info) => set({ info }),
  showToast: (toast) => {
    clearTimeout(toastTimer);
    set({ toast });
    if (toast) toastTimer = window.setTimeout(() => { if (get().toast === toast) set({ toast: null }); }, 3500);
  },
  setLayerDetail: (layerDetail) => set({ layerDetail }),
  openWeather: (weatherAt) => set({ weatherAt, panel: 'weather', info: null }),
  startRouteAt: (routeSeed) => set({ routeSeed, tool: 'route', info: null }),

  routes: [], rides: [], pins: [], contentLoaded: false, hidden: new Set<string>(persisted<string[]>('hidden', [])), mapFilter: false,
  setContent: ({ routes, rides, pins }) => set({ routes, rides, pins, contentLoaded: true }),
  toggleHidden: (key, on) => {
    const hidden = new Set(get().hidden);
    if (on ?? !hidden.has(key)) hidden.add(key); else hidden.delete(key);
    persist('hidden', [...hidden]);
    set({ hidden });
  },
  setMapFilter: (mapFilter) => set({ mapFilter })
}));

/** The live Mapbox map, outside React state so components can call it directly. */
let mapInstance: mapboxgl.Map | null = null;
export const setMap = (m: mapboxgl.Map | null) => { mapInstance = m; };
export const getMap = () => mapInstance;
