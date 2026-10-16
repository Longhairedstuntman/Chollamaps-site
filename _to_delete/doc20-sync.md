# 20 — chollamaps.com: the web app

Started 2026-10-12. The web map for Cholla, shaped like onX's web map (see
`19-onx-web.md`) and built on the same Supabase project, Mapbox styles and
vector tilesets as the phone. Lives in `Cairn/chollamaps/`.

**Decisions**
- Separate product domain: **chollamaps.com** (+ `cholla.app` as the short link). highdesertoutdoor.co
  is the brand site and links to it.
- Vite + React 19 + TypeScript, react-router, zustand, mapbox-gl v3, supabase-js v2.
- **Sign-in required** for the map, like onX. The landing page at `/` is public.
- Map state in the URL: `/map/@38.57330,-109.54980,12.00z?b=topo&a=mtb&l=trails,mvum`.
  `?at=lon,lat` opens the spot card (that's what Share copies).
- Pro on the web = `my_pro_grant()` active, or admin/moderator. Apple-subscription Pro arrives
  when `profiles.pro_until` lands (docs/09-membership.md, "Server verification").

## Run it on your Mac

Terminal, once:
```
cd ~/Projects/highdesertoutdoor.co/Cairn/chollamaps
npm install
```
Then every time:
```
npm run dev
```
and open **http://localhost:8000**. (Port 8000 because the Mapbox token already allows
it.) `npm run build` makes `dist/` for deployment; `npm run typecheck` runs the type check.

## What's built (Oct 12)

| Area | Status |
|---|---|
| Shell | Left rail (Search, My Cholla, Explore, Offline, Account), top search + activity, right Tools + zoom + north, bottom-right Weather / Locate / 2D-3D / Layers, scale bar, Escape closes things |
| Sign-in | Email + password, create account, reset, Continue with Apple / Google buttons (need the providers set up, below) |
| Map | Cholla Topo / Night / Satellite; trails, MVUM, land from the vector tilesets with the same activity filters, difficulty colors and seasonal closures as the phone; terrain always on so elevation works; 3D is a Pro toggle |
| Layers panel | Basemap cards, layer tiles grouped Trails & routes / Conditions / Land & access / Snow & terrain / Communication, Details per layer with source and cadence, legend of what's on. Live: radar, active fires, burn areas, wilderness + WSAs, roadless, PLSS, avalanche, slope angle, SNOTEL, camping (BLM shading + USFS campgrounds + Cholla campsites), trailheads, trail-condition glow |
| Click anything | Info card for trails (uses, difficulty, seasons, source, conditions + report form, guide, posts), MVUM routes, land, trailheads, campsites, campgrounds, fires, avalanche zones, SNOTEL (latest depth/SWE), your pins, and any spot (coords + land). Actions: Pin here, Route from here, Weather, Share |
| Tools | Pin (drops at center, drag or click to move; kind, name, note), Measure distance (legs, ascent/descent, GPX, save as route), Measure area (acres, perimeter), Plan route (Snap to trails / Trail Blazer, Undo, Clear, per-leg flip, distance + ascent/descent + elevation profile, GPX, Save) |
| My Cholla | All / Routes / Rides / Pins / Crews; folder chips; search; sort; "Only what's on the map"; Select → move to folder / hide / export GPX / delete; per-item show, hide, export, rename, folder, delete; GPX + KML import (tracks → rides, points → pins, into a folder) |
| Explore | Jump to the 10 areas; trails on the map right now, by name and difficulty |
| Weather | NWS hourly (12 h) + weekly for the map center or a spot |
| Account | Pro status, display name, units (drives the scale bar), Print this view, sign out |
| Landing | Product page at `/` |

**Routing note.** Snap-to-trail builds its graph from the trail and MVUM tiles loaded around
the view (`querySourceFeatures`), so zoom to the area first; long legs across unloaded tiles
fall back to Mapbox road directions or a straight line, and say so.

## Setup still to do (all in dashboards)

1. **Mapbox token** — mapbox.com → Tokens → the public token → Allowed URLs: add
   `https://chollamaps.com`, `https://www.chollamaps.com`, `https://cholla.app`, and keep
   `http://localhost:8000`.
2. **Supabase Auth** — Authentication → URL Configuration: Site URL `https://chollamaps.com`;
   Redirect URLs add `https://chollamaps.com/**`, `http://localhost:8000/**` (keep `cholla://auth-callback`).
3. **Google sign-in** — Google Cloud Console → OAuth client (Web): authorized redirect URI
   `https://qddmsavyisjojdrhvavm.supabase.co/auth/v1/callback`; paste client ID + secret into
   Supabase → Authentication → Providers → Google. Also add the iOS client ID there for the app.
4. **Apple sign-in on the web** — Apple Developer → Identifiers → **Services ID** (e.g.
   `co.highdesertoutdoor.cholla.web`), enable Sign in with Apple, domain `chollamaps.com`,
   return URL `https://qddmsavyisjojdrhvavm.supabase.co/auth/v1/callback`; make a Sign in with
   Apple key; in Supabase → Providers → Apple, set the Services ID as client ID and generate the
   secret from the key. (The native app keeps `co.highdesertoutdoor.Cholla`.)
5. **Hosting** — the build is a static SPA (`dist/`, with `vercel.json` and `public/_redirects`
   for the history fallback). Easiest GUI path: Vercel or Cloudflare Pages → import the Cairn repo
   → root directory `chollamaps` → build `npm run build`, output `dist` → add the custom domain
   `chollamaps.com` and point `cholla.app` at it as a redirect. GitHub Pages works too but only
   one site per repo, and highdesertoutdoor.co already has that slot.
6. **DNS** — at the registrar: `chollamaps.com` A/CNAME to the host, `www` CNAME, `cholla.app`
   forwarded to `https://chollamaps.com` (`.app` requires HTTPS, which the forwarder handles).

## Landing hero (the 3D map at the top of `/`)

The hero is a live Mapbox map of Redfish Lake looking at Mt. Heyburn (`HERO` in
`src/pages/Landing.tsx`), fenced to the Sawtooths (`HERO_FENCE`), pitched 62°, with terrain.
It shows in 3D from the first frame because a still of exactly that camera
(`public/brand/hero-sawtooths.jpg`) sits underneath; the live map fades in over it once its
tiles have settled, then turns slowly. Any real use (drag, ⌘+scroll, two-finger pan, the +/−
buttons) stops the turn and fades the headline and lede out; 15 s after the last touch it
flies home and they fade back in. The buttons and the small note stay the whole time.

**To change the opening view**, edit `HERO`, then recapture the still:
1. Open `http://localhost:8000/?still=1` in a window whose page area is **1728×962** (that's
   what `HERO_STILL.w/h` says; if your window is a different size, set those to its
   `window.innerWidth/innerHeight`). Capture mode hides everything but the map.
2. Wait until every tile is sharp (10–20 s), screenshot the page area, save it as
   `public/brand/hero-sawtooths.jpg` (JPEG ~80 quality; the pixel size doesn't matter, only
   the aspect ratio, which must match the window).
3. Reload `/`: the first frame and the live map should line up with no visible jump.

## Next

- Share links that open for people without an account (the spot card already works from `?at=`).
- Public trail pages at `/trails/{state}/{slug}` for search engines (the Trailforks model).
- Offline areas planned on the web, downloaded on the phone (needs an `offline_areas` table).
- Print with a scale bar and grid as a PDF, not just the browser print.
- Cell coverage layer (FCC data, processed).
- Pro purchase on the web (Stripe) if subscribing in the app proves to be friction.
- Code-split mapbox-gl into its own chunk; the bundle is 2.4 MB (690 kB gzipped).
