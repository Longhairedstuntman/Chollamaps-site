import type { ReactElement } from 'react';
import { useApp, type PanelId } from '../state/store';
import { I } from './Icons';

const TOP: Array<{ id: PanelId; label: string; icon: () => ReactElement }> = [
  { id: 'search', label: 'Search', icon: I.search },
  { id: 'mine', label: 'My Cholla', icon: I.mine },
  { id: 'explore', label: 'Explore', icon: I.explore },
  { id: 'offline', label: 'Offline maps', icon: I.offline }
];

/** The left rail: onX's left toolbar — Search, My Content, Discover, Offline Maps, Account at the bottom. */
export default function Rail() {
  const panel = useApp((s) => s.panel), setPanel = useApp((s) => s.setPanel);
  const pro = useApp((s) => s.pro);
  const name = useApp((s) => s.profile?.display_name || s.session?.user.email || '');
  return (
    <nav className="rail" aria-label="Main">
      <a className="rail-brand" href="/" title="Cholla Maps"><img src="/brand/cholla-mark-192.png" alt="Cholla" /></a>
      {TOP.map((b) => (
        <button key={b.id} type="button" className="rail-btn" aria-pressed={panel === b.id} onClick={() => setPanel(b.id)} title={b.label}>
          {b.icon()}<span>{b.label}</span>
        </button>
      ))}
      <div className="rail-spacer" />
      <button type="button" className="rail-btn" aria-pressed={panel === 'account'} onClick={() => setPanel('account')} title={name || 'Account'}>
        {I.account()}<span>{pro ? 'Pro' : 'Account'}</span>
      </button>
    </nav>
  );
}
