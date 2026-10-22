import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from './auth/AuthContext';
import { ChurchLayout } from './components/ChurchLayout';
import { SuperLayout } from './components/SuperLayout';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { PreacherNotice } from './pages/PreacherNotice';
import { Dashboard } from './pages/church/Dashboard';
import { Lives } from './pages/church/Lives';
import { Members } from './pages/church/Members';
import { Preachers } from './pages/church/Preachers';
import { Sermons } from './pages/church/Sermons';
import { Subscription } from './pages/church/Subscription';
import { AuditLog } from './pages/super/AuditLog';
import { Churches } from './pages/super/Churches';
import { Plans } from './pages/super/Plans';
import { Usage } from './pages/super/Usage';

type Area = 'church' | 'super' | 'preacher';

/** Accès réservé : renvoie vers la connexion, ou vers l'espace qui correspond au rôle. */
function Guard({ area, children }: { area: Area; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="center-msg">Chargement…</p>;
  if (!user) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  const allowed =
    (area === 'super' && user.platformRole === 'SUPER_ADMIN') ||
    (area === 'church' && user.staff?.role === 'ADMIN') ||
    (area === 'preacher' && user.staff?.role === 'PREACHER');
  return allowed ? <>{children}</> : <Navigate to={homeFor(user)} replace />;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <p className="center-msg">Chargement…</p>;
  return <Navigate to={homeFor(user)} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/connexion" element={<Login />} />
      <Route path="/inscription" element={<Onboarding />} />
      <Route
        path="/predicateur"
        element={
          <Guard area="preacher">
            <PreacherNotice />
          </Guard>
        }
      />
      <Route
        path="/eglise"
        element={
          <Guard area="church">
            <ChurchLayout />
          </Guard>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="predications" element={<Sermons />} />
        <Route path="directs" element={<Lives />} />
        <Route path="predicateurs" element={<Preachers />} />
        <Route path="membres" element={<Members />} />
        <Route path="abonnement" element={<Subscription />} />
      </Route>
      <Route
        path="/super"
        element={
          <Guard area="super">
            <SuperLayout />
          </Guard>
        }
      >
        <Route index element={<Navigate to="eglises" replace />} />
        <Route path="eglises" element={<Churches />} />
        <Route path="plans" element={<Plans />} />
        <Route path="consommation" element={<Usage />} />
        <Route path="journal" element={<AuditLog />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
