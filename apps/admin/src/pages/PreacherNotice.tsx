import { useAuth } from '../auth/AuthContext';
import { PublicFrame } from './PublicFrame';

/** Un prédicateur qui se connecte ici est renvoyé vers l'application mobile. */
export function PreacherNotice() {
  const { user, logout } = useAuth();
  return (
    <PublicFrame>
      <div className="public-body">
        <div className="auth-card">
          <h1 className="h1" style={{ fontSize: 32 }}>
            Bonjour {user?.name}
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.45 }}>
            Votre compte prédicateur s'utilise dans l'application mobile Fahazavana : préparer et lancer
            les directs, importer et suivre vos prédications. Cette console est réservée aux administrateurs.
          </p>
          <button className="btn btn--block" onClick={() => void logout()}>
            Se déconnecter
          </button>
        </div>
      </div>
    </PublicFrame>
  );
}
