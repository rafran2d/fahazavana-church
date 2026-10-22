import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Churches, Plans } from '../api/endpoints';
import type { Plan } from '../api/types';
import { homeFor, useAuth } from '../auth/AuthContext';
import { useToast } from '../components/ui';
import { LANGUAGES, isEmail, minutesToHours, num } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { PublicFrame } from './PublicFrame';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Création de l'espace d'une église (maquette 01).
 * Étape 1 : compte du futur Church Admin. Étape 2 : église + plan. Étape 3 : essai activé.
 * Le paiement est saisi ensuite par le Super Admin (MVP) : l'église démarre en essai de 30 jours.
 */
export function Onboarding() {
  const { user } = useAuth();
  const [done, setDone] = useState(false);

  if (done) return <Done />;
  if (user && user.staff) return <Navigate to={homeFor(user)} replace />;
  if (user?.platformRole === 'SUPER_ADMIN') return <Navigate to={homeFor(user)} replace />;
  return user ? <ChurchStep onDone={() => setDone(true)} /> : <AccountStep />;
}

function AccountStep() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Indiquez votre nom.');
    if (!isEmail(form.email)) return setError('Email invalide.');
    if (form.password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.');
    setBusy(true);
    setError(null);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <PublicFrame step="Étape 1 sur 3">
      <div className="public-body">
        <form className="auth-card" onSubmit={submit}>
          <h1 className="h1">Votre compte administrateur</h1>
          <p className="muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.45 }}>
            Vous gérerez l'église, ses prédicateurs, ses membres et son abonnement.
          </p>
          <div className="field">
            <label htmlFor="name">Nom</label>
            <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input id="password" className="input" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
            <span className="field-hint">8 caractères minimum</span>
          </div>
          {error && <span className="form-error">{error}</span>}
          <button className="btn btn--dark btn--block" disabled={busy}>
            {busy ? 'Création…' : 'Continuer'}
          </button>
          <span className="muted" style={{ textAlign: 'center', fontSize: 14 }}>
            Déjà inscrit ? <Link to="/connexion">Se connecter</Link>
          </span>
        </form>
      </div>
    </PublicFrame>
  );
}

function ChurchStep({ onDone }: { onDone: () => void }) {
  const { reload, logout } = useAuth();
  const plans = useAsync(() => Plans.list(), []);
  const [form, setForm] = useState({ name: '', city: '', description: '', sourceLanguage: 'mg' });
  const [targets, setTargets] = useState<string[]>(['fr', 'en']);
  const [planId, setPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = planId ?? plans.data?.find((p) => p.name === 'Standard')?.id ?? plans.data?.[0]?.id ?? null;
  const otherLangs = Object.keys(LANGUAGES).filter((l) => l !== form.sourceLanguage);
  const activeTargets = targets.filter((t) => t !== form.sourceLanguage);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Indiquez le nom de l'église.");
    if (!chosen) return setError('Choisissez un plan.');
    setBusy(true);
    setError(null);
    // La ville n'a pas de colonne dédiée au MVP : elle préfixe la description.
    const description = [form.city.trim(), form.description.trim()].filter(Boolean).join(' — ');
    try {
      await Churches.create({
        name: form.name.trim(),
        description: description || undefined,
        sourceLanguage: form.sourceLanguage,
        targetLanguages: activeTargets,
        planId: chosen,
      });
      onDone();
      await reload();
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const toggleTarget = (l: string) =>
    setTargets((t) => (t.includes(l) ? t.filter((x) => x !== l) : [...t, l].slice(-2)));

  return (
    <PublicFrame step="Étape 2 sur 3">
      <form className="onboard" onSubmit={submit}>
        <div className="onboard-col">
          <h1 className="h1">Votre église</h1>
          <div className="row" style={{ gap: 16 }}>
            <div className="logo-ph">logo</div>
            <span className="muted small">Le logo pourra être ajouté depuis l'application.</span>
          </div>
          <div className="field">
            <label htmlFor="cname">Nom de l'église</label>
            <input id="cname" className="input" value={form.name} onChange={set('name')} placeholder="Tempoly Fitiavana" />
          </div>
          <div className="field">
            <label htmlFor="city">Ville</label>
            <input id="city" className="input" value={form.city} onChange={set('city')} placeholder="Antananarivo, Analakely" />
          </div>
          <div className="field">
            <label htmlFor="lang">Langue des prédications</label>
            <select id="lang" className="select input" value={form.sourceLanguage} onChange={set('sourceLanguage')}>
              {Object.entries(LANGUAGES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="label">Traductions</span>
            <div className="row" style={{ gap: 8 }}>
              {otherLangs.map((l) => (
                <button type="button" key={l} className={`chip chip--soft${activeTargets.includes(l) ? ' on' : ''}`} onClick={() => toggleTarget(l)} aria-pressed={activeTargets.includes(l)}>
                  {activeTargets.includes(l) ? '✓ ' : ''}
                  {LANGUAGES[l]}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="desc">Description</label>
            <textarea id="desc" className="textarea" value={form.description} onChange={set('description')} placeholder="Horaires des cultes, quartier…" />
          </div>
        </div>

        <div className="onboard-col">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <h2 className="h1">Choisissez un plan</h2>
            <span className="muted" style={{ fontSize: 14 }}>
              Quotas mensuels, vérifiés avant chaque direct
            </span>
          </div>
          {plans.error && <span className="form-error">{plans.error.message}</span>}
          <div className="plans">
            {plans.data?.map((p) => <PlanCard key={p.id} plan={p} current={p.id === chosen} onPick={() => setPlanId(p.id)} />)}
          </div>
          <div className="note">Essai gratuit de 30 jours. L'abonnement est activé par l'équipe Fahazavana à réception du paiement.</div>
          {error && <span className="form-error">{error}</span>}
          <div className="onboard-foot">
            <button type="button" className="link-btn" style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 15 }} onClick={() => void logout()}>
              ← Changer de compte
            </button>
            <button className="btn btn--dark" style={{ height: 50, padding: '0 28px', borderRadius: 12, fontSize: 16 }} disabled={busy || !chosen}>
              {busy ? 'Création…' : "Créer l'espace de l'église"}
            </button>
          </div>
        </div>
      </form>
    </PublicFrame>
  );
}

export function PlanCard({
  plan,
  current,
  onPick,
  cta,
  tag = 'Sélectionné',
}: {
  plan: Plan;
  current: boolean;
  onPick?: () => void;
  cta?: string;
  tag?: string;
}) {
  return (
    <div className={`plan${current ? ' current' : ''}`}>
      {current && <span className="tag">{tag}</span>}
      <div className="name">{plan.name}</div>
      <dl>
        <div><dt>Stockage</dt><dd>{num(plan.storageQuotaGb, 0)} Go</dd></div>
        <div><dt>Direct</dt><dd>{minutesToHours(plan.liveQuotaMinutes)} h</dd></div>
        <div><dt>IA</dt><dd>{minutesToHours(plan.aiQuotaMinutes)} h</dd></div>
        <div><dt>Membres</dt><dd>{num(plan.memberQuota, 0)}</dd></div>
      </dl>
      {onPick ? (
        <button type="button" className="pick btn" onClick={onPick} aria-pressed={current}>
          {current ? `✓ ${plan.name}` : 'Choisir'}
        </button>
      ) : (
        cta && <span className="pick">{cta}</span>
      )}
    </div>
  );
}

function Done() {
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <PublicFrame step="Étape 3 sur 3">
      <div className="public-body">
        <div className="auth-card">
          <span className="logo-dot" style={{ width: 44, height: 44 }} />
          <h1 className="h1">Votre espace est prêt</h1>
          <p className="muted" style={{ margin: 0, fontSize: 16, lineHeight: 1.45 }}>
            L'essai de 30 jours est activé. Créez maintenant le compte de vos prédicateurs : ils pourront lancer
            les directs depuis l'application mobile.
          </p>
          <button
            className="btn btn--dark btn--block"
            onClick={() => {
              toast.show('Bienvenue sur Fahazavana');
              navigate('/eglise/predicateurs', { replace: true });
            }}
          >
            Ajouter un prédicateur
          </button>
          <button className="btn btn--block" onClick={() => navigate('/eglise', { replace: true })}>
            Aller au tableau de bord
          </button>
        </div>
      </div>
    </PublicFrame>
  );
}
