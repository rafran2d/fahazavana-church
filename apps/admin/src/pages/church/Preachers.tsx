import { useState, type FormEvent } from 'react';
import { Churches } from '../../api/endpoints';
import type { StaffMember } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { useChurch } from '../../components/ChurchLayout';
import { ErrorNote, Modal, Status, useToast } from '../../components/ui';
import { date, initials, isEmail, temporaryPassword } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function Preachers() {
  const { churchId } = useChurch();
  const { user } = useAuth();
  const toast = useToast();
  const staff = useAsync(() => Churches.staff(churchId), [churchId]);
  const [creating, setCreating] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const toggle = async (m: StaffMember) => {
    const status = m.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setPending(m.id);
    try {
      const updated = await Churches.updateStaff(churchId, m.id, { status });
      staff.setData((list) => list?.map((x) => (x.id === m.id ? updated : x)));
      toast.show(status === 'SUSPENDED' ? `${m.user.name} est suspendu : il ne peut plus lancer de direct` : `${m.user.name} est réactivé`);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1 className="h1">Prédicateurs</h1>
        <button className="btn btn--dark" onClick={() => setCreating(true)}>
          + Nouveau prédicateur
        </button>
      </div>

      {staff.error && <ErrorNote message={staff.error.message} onRetry={staff.reload} />}

      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Ajouté le</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {staff.data?.map((m) => {
              const self = m.user.id === user?.id;
              const active = m.status === 'ACTIVE';
              return (
                <tr key={m.id} className={highlight === m.id ? 'selected' : undefined}>
                  <td>
                    <span className="cell-person">
                      <span className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                        {initials(m.user.name)}
                      </span>
                      {m.user.name}
                    </span>
                  </td>
                  <td className="muted">{m.user.email}</td>
                  <td>{m.role === 'ADMIN' ? 'Church Admin' : 'Prédicateur'}</td>
                  <td>{date(m.createdAt)}</td>
                  <td>
                    {self ? (
                      <Status tone="ok">● Actif</Status>
                    ) : (
                      <button
                        className="link-btn"
                        style={{ fontWeight: 500, fontSize: 15, color: active ? 'var(--green)' : 'var(--placeholder)' }}
                        title={active ? 'Cliquer pour suspendre' : 'Cliquer pour réactiver'}
                        disabled={pending === m.id}
                        onClick={() => void toggle(m)}
                      >
                        {active ? '● Actif' : '● Suspendu'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {staff.loading && !staff.data && <div className="table-empty">Chargement…</div>}
      </div>
      <span className="muted small">Cliquez sur un statut pour suspendre ou réactiver un compte.</span>

      {creating && (
        <CreatePreacher
          onClose={() => setCreating(false)}
          onCreated={(m) => {
            staff.setData((list) => [...(list ?? []), m]);
            setHighlight(m.id);
          }}
        />
      )}
    </>
  );
}

function CreatePreacher({ onClose, onCreated }: { onClose: () => void; onCreated: (m: StaffMember) => void }) {
  const { churchId, church } = useChurch();
  const [form, setForm] = useState({ name: '', email: '', bio: '', password: temporaryPassword() });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<StaffMember | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Indiquez un nom.');
    if (!isEmail(form.email)) return setError('Email invalide.');
    if (form.password.length < 8) return setError('Le mot de passe provisoire doit contenir au moins 8 caractères.');
    setBusy(true);
    setError(null);
    try {
      const m = await Churches.createPreacher(churchId, {
        name: form.name.trim(),
        email: form.email.trim(),
        temporaryPassword: form.password,
        bio: form.bio.trim() || undefined,
      });
      onCreated(m);
      setCreated(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  if (created) {
    const credentials = `Email : ${created.user.email}\nMot de passe provisoire : ${form.password}`;
    return (
      <Modal title="Compte créé" onClose={onClose}>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Transmettez ces identifiants à <b>{created.user.name}</b>. Il se connecte dans l'application mobile
          Fahazavana.
        </p>
        <div className="card card-pad" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, whiteSpace: 'pre-wrap' }}>
          {credentials}
        </div>
        <div className="modal-actions">
          <button
            className="btn"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(credentials)
                .then(() => setCopied(true))
                .catch(() => undefined)
            }
          >
            {copied ? '✓ Copié' : 'Copier'}
          </button>
          <button className="btn btn--ochre" onClick={onClose}>
            Terminé
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Nouveau prédicateur" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="p-name">Nom complet</label>
            <input id="p-name" className="input" style={{ height: 44 }} value={form.name} onChange={set('name')} placeholder="ex. Andrianaivo Tojo" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="p-email">Email</label>
            <input id="p-email" className="input" style={{ height: 44 }} type="email" value={form.email} onChange={set('email')} placeholder="tojo@fitiavana.mg" />
          </div>
        </div>
        <div className="field">
          <label htmlFor="p-pwd">Mot de passe provisoire</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input id="p-pwd" className="input" style={{ height: 44, fontFamily: "'JetBrains Mono', monospace" }} value={form.password} onChange={set('password')} />
            <button type="button" className="btn" onClick={() => setForm({ ...form, password: temporaryPassword() })}>
              Générer
            </button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="p-bio">Biographie</label>
          <textarea id="p-bio" className="textarea" style={{ minHeight: 76 }} value={form.bio} onChange={set('bio')} placeholder="Quelques lignes visibles par les membres…" />
        </div>
        <div className="note">
          <span style={{ fontWeight: 700, color: 'var(--ochre-dark)' }}>⚿</span>
          <span>
            Rattaché à <b>{church.name}</b> uniquement. Il pourra créer des prédications et lancer des directs pour
            cette église.
          </span>
        </div>
        {error && <span className="form-error">{error}</span>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn--ochre" disabled={busy}>
            {busy ? 'Création…' : 'Créer le compte'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
