import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../auth/AuthContext';
import { PublicFrame } from './PublicFrame';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await login(email, password);
      const home = homeFor(me);
      navigate(from && from.startsWith(home) ? from : home, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <PublicFrame>
      <div className="public-body">
        <form className="auth-card" onSubmit={submit}>
          <span className="logo-dot" style={{ width: 44, height: 44 }} />
          <h1 className="h1" style={{ fontSize: 34 }}>
            Espace administration
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.45 }}>
            Church Admin et Super Admin. Les prédicateurs et les membres utilisent l'application mobile.
          </p>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <span className="form-error">{error}</span>}
          <button className="btn btn--dark btn--block" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
          <span className="muted" style={{ textAlign: 'center', fontSize: 14 }}>
            Nouvelle église ? <Link to="/inscription">Créer l'espace de votre église</Link>
          </span>
        </form>
      </div>
    </PublicFrame>
  );
}
