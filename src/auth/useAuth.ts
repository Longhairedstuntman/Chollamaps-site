import { useEffect } from 'react';
import { sb } from '../lib/supabase';
import { useApp, type Profile } from '../state/store';

/** Keeps the store's session, profile and Pro status in step with Supabase. Mount once. */
export function useAuth() {
  const setSession = useApp((s) => s.setSession);
  const setProfile = useApp((s) => s.setProfile);
  useEffect(() => {
    let alive = true;
    sb.auth.getSession().then(({ data }) => { if (alive) setSession(data.session); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { if (alive) setSession(session); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [setSession]);

  const userId = useApp((s) => s.session?.user.id);
  useEffect(() => {
    if (!userId) { setProfile(null, false); return; }
    let alive = true;
    (async () => {
      const [{ data: p }, { data: g }] = await Promise.all([
        sb.from('profiles').select('id, display_name, username, role, units').eq('id', userId).maybeSingle(),
        sb.rpc('my_pro_grant')
      ]);
      if (!alive) return;
      const profile = (p as Profile | null) ?? null;
      const grant = (Array.isArray(g) ? g[0] : g) as { active?: boolean } | null;
      const staff = profile?.role === 'admin' || profile?.role === 'moderator';
      setProfile(profile, !!(grant?.active || staff));
    })();
    return () => { alive = false; };
  }, [userId, setProfile]);
}

export async function signOut() {
  await sb.auth.signOut();
  useApp.getState().setContent({ routes: [], rides: [], pins: [] });
}
