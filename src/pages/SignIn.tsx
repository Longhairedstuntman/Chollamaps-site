import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { sb } from '../lib/supabase';
import { useApp } from '../state/store';

type Mode = 'in' | 'up' | 'reset';

/** Sign in / create account / reset. Same account as the Cholla app. */
export default function SignIn() {
  const session = useApp((s) => s.session), authReady = useApp((s) => s.authReady);
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('');
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const next = new URLSearchParams(useLocation().search).get('next') || '/map';
  if (authReady && session) return <Navigate to={next} replace />;

  // OAuth comes back to the bare origin (what the Supabase allow-list holds); App sends you on to `next`.
  const redirectTo = location.origin;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      if (mode === 'in') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) setMsg(error.message);
      } else if (mode === 'up') {
        const { error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo, data: { full_name: name } } });
        setMsg(error ? error.message : 'Check your email to confirm your account, then sign in.');
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/sign-in' });
        setMsg(error ? error.message : 'Check your email for the reset link.');
      }
    } finally { setBusy(false); }
  };
  const oauth = async (provider: 'apple' | 'google') => {
    try { sessionStorage.setItem('cholla.next', next); } catch { /* ignore */ }
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) setMsg(error.message);
  };

  return (
    <div className="auth">
      <div className="auth-art" aria-hidden="true" />
      <form className="auth-card" onSubmit={submit}>
        <Link to="/" className="auth-brand"><img src="/brand/cholla-logo-640w.png" srcSet="/brand/cholla-logo-640w.png 1x, /brand/cholla-logo-1280w.png 2x" alt="Cholla" height="34" /></Link>
        <h1>{mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create your account' : 'Reset your password'}</h1>
        <p className="fine">Same account as the Cholla app. Routes you plan here are on your phone after its next sync.</p>
        {mode === 'up' && <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        {mode !== 'reset' && <input className="input" type="password" placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required />}
        <button type="submit" className="btn primary big" disabled={busy}>{mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}</button>
        {mode !== 'reset' && <>
          <div className="or"><span>or</span></div>
          <button type="button" className="btn big" onClick={() => oauth('apple')}> Continue with Apple</button>
          <button type="button" className="btn big" onClick={() => oauth('google')}>Continue with Google</button>
        </>}
        {msg && <p className={'fine ' + (/check your email/i.test(msg) ? '' : 'err')}>{msg}</p>}
        <p className="fine links">
          {mode === 'in' && <><button type="button" className="link" onClick={() => setMode('up')}>Create an account</button> · <button type="button" className="link" onClick={() => setMode('reset')}>Forgot password</button></>}
          {mode !== 'in' && <button type="button" className="link" onClick={() => setMode('in')}>Back to sign in</button>}
        </p>
      </form>
    </div>
  );
}
