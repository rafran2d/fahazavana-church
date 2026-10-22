import { useState, type FormEvent } from 'react';
import { Admin, Plans } from '../../api/endpoints';
import type { Plan } from '../../api/types';
import { quotasOf } from '../../components/ChurchLayout';
import { Bar, Drawer, ErrorNote, Status, useToast } from '../../components/ui';
import { date, langName, minutesToHours, num, quotaText, ratio } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { HEALTH, useChurchesOverview, type ChurchRow } from '../../lib/useChurchesOverview';

type Filter = 'all' | 'issues' | string;

export function Churches() {
  const rows = useChurchesOverview();
  const plans = useAsync(() => Plans.list(), []);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const all = rows.data ?? [];
  const q = query.trim().toLowerCase();
  const list = all.filter(
    (r) =>
      (filter === 'all' || (filter === 'issues' ? r.health !== 'active' && r.health !== 'trial' : r.plan === filter)) &&
      (!q || `${r.church.name} ${r.church.description ?? ''}`.toLowerCase().includes(q)),
  );
  const planNames = plans.data?.map((p) => p.name) ?? [];
  const count = (name: string) => all.filter((r) => r.plan === name).length;
  const aiMinutes = all.reduce((acc, r) => acc + (r.usage?.ai.used ?? 0), 0);
  const issues = all.filter((r) => r.health !== 'active' && r.health !== 'trial').length;
  const open = all.find((r) => r.church.id === openId) ?? null;

  return (
    <>
      <div className="page-head">
        <h1 className="h1">Églises</h1>
        <input className="input input--search" type="search" placeholder="Rechercher une église…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher une église" />
      </div>

      {rows.error && <ErrorNote message={rows.error.message} onRetry={rows.reload} />}

      <div className="kpis">
        <div className="card card-pad kpi">
          <span className="label muted">Églises actives</span>
          <span className="value" style={{ fontSize: 36 }}>{all.filter((r) => r.church.status === 'ACTIVE' && r.usage).length}</span>
        </div>
        <div className="card card-pad kpi" style={{ gap: 6 }}>
          <span className="label muted">Répartition des plans</span>
          <span className="text">{planNames.map((n) => `${count(n)} ${n}`).join(' · ') || '—'}</span>
        </div>
        <div className="card card-pad kpi">
          <span className="label muted">Heures IA (périodes en cours)</span>
          <span className="value" style={{ fontSize: 36 }}>{minutesToHours(aiMinutes)} h</span>
        </div>
        <div className="card card-pad kpi">
          <span className="label muted">À traiter</span>
          <span className="value" style={{ fontSize: 36, color: issues ? 'var(--red)' : undefined }}>{issues}</span>
        </div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        {[['all', 'Toutes'], ...planNames.map((n) => [n, n]), ['issues', 'À traiter']].map(([k, label]) => (
          <button key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k!)} aria-pressed={filter === k}>
            {label}
          </button>
        ))}
      </div>

      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Église</th>
              <th>Plan</th>
              <th>Direct</th>
              <th>IA</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const h = HEALTH[r.health];
              return (
                <tr key={r.church.id} className={`clickable${openId === r.church.id ? ' selected' : ''}`} onClick={() => setOpenId(r.church.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpenId(r.church.id)}>
                  <td>{r.church.name}</td>
                  <td>{r.plan ?? r.church.subscriptions[0]?.plan.name ?? '—'}</td>
                  <td>{r.usage ? <UsageCell used={r.usage.live.used} limit={r.usage.live.limit} /> : <span className="st--off">—</span>}</td>
                  <td>{r.usage ? <UsageCell used={r.usage.ai.used} limit={r.usage.ai.limit} /> : <span className="st--off">—</span>}</td>
                  <td>
                    <Status tone={h.tone}>{h.label}</Status>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.loading && !rows.data && <div className="table-empty">Chargement…</div>}
        {rows.data && list.length === 0 && <div className="table-empty">Aucune église ne correspond.</div>}
      </div>

      {open && <ChurchPanel row={open} plans={plans.data ?? []} onClose={() => setOpenId(null)} onChanged={rows.reload} />}
    </>
  );
}

function UsageCell({ used, limit }: { used: number; limit: number }) {
  const r = ratio(used, limit);
  return (
    <span className="inline-bar">
      <Bar ratio={r} alert={r >= 0.9} />
      {minutesToHours(used)}/{minutesToHours(limit)} h
    </span>
  );
}

function ChurchPanel({ row, plans, onClose, onChanged }: { row: ChurchRow; plans: Plan[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const { church, usage } = row;
  const sub = church.subscriptions[0];
  const suspended = church.status === 'SUSPENDED';
  const [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await Admin.setChurchStatus(church.id, suspended ? 'ACTIVE' : 'SUSPENDED');
      toast.show(suspended ? 'Église réactivée' : "Église suspendue : elle n'apparaît plus dans la recherche");
      await onChanged();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const subLine = !usage
    ? sub
      ? `Expiré le ${date(sub.endAt)}`
      : 'Aucun abonnement'
    : `${sub?.status === 'TRIAL' ? 'Essai' : 'Actif'} jusqu'au ${date(usage.periodEnd)}`;

  return (
    <Drawer label={church.name} onClose={onClose}>
      <div className="modal-head" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="serif" style={{ fontSize: 28, lineHeight: 1.15 }}>
            {church.name}
          </span>
          <span className="muted" style={{ fontSize: 14 }}>
            {num(usage?.members.used ?? church._count.memberships, 0)} membres · {church._count.sermons} prédications ·{' '}
            {[church.sourceLanguage, ...church.targetLanguages].map(langName).join(' → ')}
          </span>
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Fermer">
          ×
        </button>
      </div>

      {usage ? (
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {quotasOf(usage).map((q) => (
            <div key={q.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 14 }}>
                <span>{q.label}</span>
                <span style={{ fontWeight: 600 }}>{quotaText(q)}</span>
              </div>
              <Bar ratio={q.ratio} alert={q.alert} />
            </div>
          ))}
        </div>
      ) : (
        <div className="note">Pas d'abonnement actif : directs, nouveaux abonnés et traitements IA sont bloqués.</div>
      )}

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '12px 14px', gap: 12 }}>
        <span className="muted">Abonnement{sub ? ` · ${sub.plan.name}` : ''}</span>
        <Status tone={usage ? 'ok' : 'bad'}>{subLine}</Status>
      </div>

      {assigning ? (
        <AssignForm
          churchId={church.id}
          plans={plans}
          currentPlanId={sub?.plan.id}
          onCancel={() => setAssigning(false)}
          onDone={async () => {
            setAssigning(false);
            await onChanged();
          }}
        />
      ) : (
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn--ochre btn--block" style={{ height: 46 }} onClick={() => setAssigning(true)}>
            {usage ? 'Changer de plan / prolonger' : "Renouveler l'abonnement"}
          </button>
          <button className={`btn btn--block ${suspended ? 'btn--success' : 'btn--danger'}`} style={{ height: 46 }} onClick={() => void toggle()} disabled={busy}>
            {suspended ? "Réactiver l'église" : "Suspendre l'église"}
          </button>
        </div>
      )}
    </Drawer>
  );
}

function AssignForm({
  churchId,
  plans,
  currentPlanId,
  onCancel,
  onDone,
}: {
  churchId: string;
  plans: Plan[];
  currentPlanId?: string;
  onCancel: () => void;
  onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [planId, setPlanId] = useState(currentPlanId ?? plans[0]?.id ?? '');
  const [months, setMonths] = useState('1');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const plan = plans.find((p) => p.id === planId);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const m = Number(months);
    if (!plan) return setError('Choisissez un plan.');
    if (!Number.isInteger(m) || m < 1 || m > 36) return setError('Durée entre 1 et 36 mois.');
    const ar = amount.trim() ? Number(amount.replace(/\s/g, '').replace(',', '.')) : undefined;
    if (ar !== undefined && !(ar >= 0)) return setError('Montant invalide.');
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + m);
    setBusy(true);
    setError(null);
    try {
      await Admin.assignSubscription(churchId, {
        planId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        amountCents: ar === undefined ? undefined : Math.round(ar * 100),
        paymentReference: reference.trim() || undefined,
      });
      toast.show(`Abonnement ${plan.name} activé jusqu'au ${date(end.toISOString())}`);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span style={{ fontWeight: 600 }}>Nouvel abonnement</span>
      <div className="row" style={{ gap: 8 }}>
        {plans.map((p) => (
          <button type="button" key={p.id} className={`chip${p.id === planId ? ' on' : ''}`} onClick={() => setPlanId(p.id)} aria-pressed={p.id === planId}>
            {p.name}
          </button>
        ))}
      </div>
      {plan && (
        <span className="muted small">
          {minutesToHours(plan.liveQuotaMinutes)} h de direct ·{' '}
          {minutesToHours(plan.aiQuotaMinutes)} h d'IA · {plan.storageQuotaGb} Go · {num(plan.memberQuota, 0)} membres
        </span>
      )}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="months">Durée (mois)</label>
          <input id="months" className="input" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="amount">Montant reçu (Ar)</label>
          <input id="amount" className="input" inputMode="decimal" placeholder="optionnel" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ref">Référence du paiement</label>
        <input id="ref" className="input" placeholder="ex. MVola 0341234567 / virement" value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>
      <span className="muted small">L'abonnement en cours est clôturé et remplacé à partir d'aujourd'hui.</span>
      {error && <span className="form-error">{error}</span>}
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Annuler
        </button>
        <button className="btn btn--ochre" disabled={busy}>
          Activer
        </button>
      </div>
    </form>
  );
}
