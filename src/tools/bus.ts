/* The active tool claims map clicks before the info card does. */

type Handler = (e: mapboxgl.MapMouseEvent) => boolean;
let handler: Handler | null = null;
export const claimClicks = (h: Handler | null) => { handler = h; };
export const dispatchClick = (e: mapboxgl.MapMouseEvent) => (handler ? handler(e) : false);
