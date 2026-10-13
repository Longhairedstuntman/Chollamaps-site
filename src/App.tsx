import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useApp } from './state/store';
import { useAuth } from './auth/useAuth';
import Landing from './pages/Landing';
import SignIn from './pages/SignIn';
import MapPage from './pages/MapPage';

function Shell() {
  useAuth();
  // After an OAuth round trip we land on '/', so finish the trip to wherever sign-in started.
  const session = useApp((s) => s.session), navigate = useNavigate();
  useEffect(() => {
    if (!session) return;
    let next = '';
    try { next = sessionStorage.getItem('cholla.next') || ''; sessionStorage.removeItem('cholla.next'); } catch { /* ignore */ }
    if (next && next.startsWith('/')) navigate(next, { replace: true });
  }, [session, navigate]);
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/map/:view" element={<MapPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <BrowserRouter><Shell /></BrowserRouter>;
}
