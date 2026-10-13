import { useState } from 'react';
import { signOut } from '../auth/useAuth';
import { sb } from '../lib/supabase';
import { useApp } from '../state/store';
import { I } from '../shell/Icons';
import Panel from './Panel';

/** Account & settings — bottom-left in onX too, with Print at the end. */
export default function AccountPanel({ onClose }: { onClose: () => void }) {
  const session = useApp((s) => s.session), profile = useApp((s) => s.profile), pro = useApp((s) => s.pro), setProfile = useApp((s) => s.setProfile), toast = useApp((s) => s.showToast);
  const [name, setName] = useState(profile?.display_name || '');
  if (!session) return null;
  const units = profile?.units || 'imperial';
  const saveUnits = async (u: 'imperial' | 'metric') => {
    const { error } = await sb.from('profiles').update({ units: u }).eq('id', session.user.id);
    if (error) return toast(error.message);
    setProfile(profile ? { ...profile, units: u } : null, pro);
  };
  const saveName = async () => {
    const { error } = await sb.from('profiles').update({ display_name: name.slice(0, 60) }).eq('id', session.user.id);
    if (error) return toast(error.message);
    setProfile(profile ? { ...profile, display_name: name } : null, pro); toast('Saved.');
  };
  return (
    <Panel title={profile?.display_name || 'Your account'} eyebrow={pro ? 'Cholla Pro' : 'Cholla Free'} onClose={onClose}>
      <p className="fine">{session.user.email}</p>
      <div className="eyebrow">Membership</div>
      {pro ? <p>You have <b>Cholla Pro</b>: 3D terrain, offline maps, crews, backup & sync, GPX import, trail submissions.</p>
        : <p>You’re on <b>Cholla Free</b>. Pro adds 3D terrain, offline maps, crews, backup & sync and more — subscribe in the Cholla app on your phone ($2.99 a month or $19.99 a year) and it’s on here the next time you sign in.</p>}
      <div className="eyebrow">Display name</div>
      <div className="row"><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /><button type="button" className="btn" onClick={saveName}>Save</button></div>
      <div className="eyebrow">Units</div>
      <div className="seg">
        <button type="button" aria-pressed={units === 'imperial'} onClick={() => saveUnits('imperial')}>Miles · feet</button>
        <button type="button" aria-pressed={units === 'metric'} onClick={() => saveUnits('metric')}>Km · meters</button>
      </div>
      <div className="eyebrow">Map</div>
      <button type="button" className="btn" onClick={() => window.print()}>{I.print({ width: 16, height: 16 })} Print this view</button>
      <p className="fine">Prints the map as it sits on screen, with the scale bar. Resize the window to frame it first.</p>
      <div className="eyebrow">Account</div>
      <button type="button" className="btn" onClick={() => void signOut()}>Sign out</button>
      <p className="fine">To delete your account, use <b>Saved → Account → Delete account</b> in the app.</p>
    </Panel>
  );
}
