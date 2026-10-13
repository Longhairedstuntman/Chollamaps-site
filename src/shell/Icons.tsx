import type { SVGProps } from 'react';

const base = (props: SVGProps<SVGSVGElement>) => ({ viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...props });

export const I = {
  search: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></svg>,
  mine: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h10" /></svg>,
  explore: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" fill="currentColor" stroke="none" /></svg>,
  offline: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M12 4v10m0 0 4-4m-4 4-4-4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></svg>,
  account: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" /></svg>,
  layers: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M12 3 2 8l10 5 10-5-10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5" /></svg>,
  locate: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /><circle cx="12" cy="12" r="7" /></svg>,
  weather: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9.5a3.5 3.5 0 0 1-.5 7H7Z" /></svg>,
  pin: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z" /><circle cx="12" cy="10" r="2.2" /></svg>,
  measure: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="m3 17 14-14 4 4L7 21zM8 12l2 2M11 9l2 2M14 6l2 2" /></svg>,
  area: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M5 5h14v14H5z" /><circle cx="5" cy="5" r="1.6" fill="currentColor" /><circle cx="19" cy="5" r="1.6" fill="currentColor" /><circle cx="5" cy="19" r="1.6" fill="currentColor" /><circle cx="19" cy="19" r="1.6" fill="currentColor" /></svg>,
  route: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M5 19c4 0 3-8 7-8s3 8 7 8" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="5" r="2" /><path d="M12 11V7" /></svg>,
  plus: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>,
  minus: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M5 12h14" /></svg>,
  close: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  back: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="m15 5-7 7 7 7" /></svg>,
  cube: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12v9m0-9L4 7.5" /></svg>,
  share: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3m0 0L8 7m4-4 4 4" /></svg>,
  eye: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>,
  eyeOff: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 13.4 13.4M6.5 6.6C4 8.3 2 12 2 12s3.5 6 10 6c1.6 0 3-.3 4.3-.9M9.9 5.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6s-1 1.8-2.9 3.5" /></svg>,
  folder: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" /></svg>,
  trash: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>,
  download: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M12 4v10m0 0 4-4m-4 4-4-4M4 19h16" /></svg>,
  check: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="m5 12 5 5 9-10" /></svg>,
  undo: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>,
  info: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>,
  compass: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m12 4 2.5 8H9.5L12 4Z" fill="currentColor" stroke="none" /><path d="m12 20-2.5-8h5L12 20Z" /></svg>,
  print: (p: SVGProps<SVGSVGElement> = {}) => <svg {...base(p)}><path d="M6 9V4h12v5M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v6H6z" /></svg>
};
