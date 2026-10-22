import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  ['/super/eglises', 'Églises'],
  ['/super/plans', 'Plans'],
  ['/super/consommation', 'Consommation IA'],
  ['/super/journal', "Journal d'activité"],
] as const;

export function SuperLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar sidebar--super">
        <div className="sidebar-brand" style={{ paddingBottom: 24 }}>
          <span className="logo-dot" />
          <span className="wordmark">Fahazavana</span>
        </div>
        {NAV.map(([to, label]) => (
          <NavLink key={to} to={to} className="nav-link">
            {label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <div className="sidebar-user">
            <span title={user!.email}>Super Admin</span>
            <button onClick={() => void logout()}>Déconnexion</button>
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
