import { useState } from 'react';
import { Plans as PlansApi, type PlanInput } from '../../api/endpoints';
import type { Plan } from '../../api/types';
import { ErrorNote, useToast } from '../../components/ui';
import { bytesToGo, minutesToHours, num, price } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useChurchesOverview } from '../../lib/useChurchesOverview';

/** Champs éditables, dans l'unité affichée (Ar, Go, h, membres). */
interface Draft {
  name: string;
  price: string;
  storage: string;
  live: string;
  ai: string;
  members: string;
}

const NEW = 'new';
const toDraft = (p: Plan): Draft => ({
  name: p.name,
  price: p.priceCents ? String(p.priceCents / 100) : '',
  storage: String(p.storageQuotaGb),
  live: String(p.liveQuotaMinutes / 60),
  ai: String(p.aiQuotaMinutes / 60),
  members: String(p.memberQuota),
});
const EMPTY: Draft = { name: '', price: '', storage: '', live: '', ai: '', members: '' };

/** Draft → valeurs API (centimes, minutes) ; renvoie un message d'erreur si invalide. */
export function parseDraft(d: Draft): PlanInput | string {
  const n = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'));
  const priceAr = d.price.trim() ? n(d.price) : 0;
  const values = { storage: n(d.storage), live: n(d.live), ai: n(d.ai), members: n(d.members) };
  if (!d.name.trim()) return 'Nom du plan manquant.';
  if (!(priceAr >= 0)) return 'Prix invalide.';
  if (!Number.isInteger(values.storage) || values.storage < 1) return 'Stockage : un nombre entier de Go.';
  if (!(values.live > 0)) return 'Direct : nombre d’heures invalide.';
  if (!(values.ai > 0)) return 'IA : nombre d’heures invalide.';
  if (!Number.isInteger(values.members) || values.members < 1) return 'Membres : un nombre entier.';
  return {
    name: d.name.trim(),
    priceCents: Math.round(priceAr * 100),
    storageQuotaGb: values.storage,
    liveQuotaMinutes: Math.round(values.live * 60),
    aiQuotaMinutes: Math.round(values.ai * 60),
    memberQuota: values.members,
  };
}

export function Plans() {
  const toast = useToast();
  const plans = useAsync(() => PlansApi.list(), []);
  const rows = useChurchesOverview();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const churchCount = (name: string) => rows.data?.filter((r) => r.plan === name).length ?? 0;
  const editingPlan = plans.data?.find((p) => p.id === editing);
  const all = rows.data ?? [];
  const sum = (k: 'ai' | 'live' | 'storage') => all.reduce((acc, r) => acc + (r.usage?.[k].used ?? 0), 0);

  const startEdit = (p: Plan | null) => {
    setEditing(p ? p.id : NEW);
    setDraft(p ? toDraft(p) : EMPTY);
    setError(null);
  };

  const save = async () => {
    const parsed = parseDraft(draft);
    if (typeof parsed === 'string') return setError(parsed);
    setBusy(true);
    setError(null);
    try {
      if (editing === NEW) {
        const created = await PlansApi.create(parsed);
        plans.setData((list) => [...(list ?? []), created]);
        toast.show(`Plan ${created.name} créé`);
      } else if (editing) {
        const { name: _name, ...quotas } = parsed;
        const updated = await PlansApi.update(editing, quotas);
        plans.setData((list) => list?.map((p) => (p.id === updated.id ? updated : p)));
        toast.show(`Plan ${updated.name} mis à jour`);
      }
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const cell = (k: keyof Draft, label: string) => (
    <td>
      <input className="input" aria-label={label} placeholder={k === 'price' ? 'Ar' : undefined} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} inputMode="decimal" />
    </td>
  );

  const editRow = (key: string, isNew: boolean, count: number) => (
    <tr key={key} className="editing">
      <td>
        {isNew ? (
          <input className="input" aria-label="Nom du plan" placeholder="Nom" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        ) : (
          <span className="serif" style={{ fontSize: 20 }}>{draft.name}</span>
        )}
      </td>
      {cell('price', 'Prix par mois (Ar)')}
      {cell('storage', 'Stockage (Go)')}
      {cell('live', 'Direct (h)')}
      {cell('ai', 'IA (h)')}
      {cell('members', 'Membres')}
      <td>{count}</td>
      <td className="right">
        <button className="btn btn--sm btn--ochre" onClick={() => void save()} disabled={busy}>
          Enregistrer
        </button>
      </td>
    </tr>
  );

  return (
    <>
      <div className="page-head">
        <h1 className="h1">Plans</h1>
        <button className="btn btn--dark" onClick={() => startEdit(null)} disabled={editing !== null}>
          + Nouveau plan
        </button>
      </div>

      {plans.error && <ErrorNote message={plans.error.message} onRetry={plans.reload} />}

      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Plan</th>
              <th>Prix / mois</th>
              <th>Stockage (Go)</th>
              <th>Direct (h)</th>
              <th>IA (h)</th>
              <th>Membres</th>
              <th>Églises</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {plans.data?.map((p) =>
              editing === p.id ? (
                editRow(p.id, false, churchCount(p.name))
              ) : (
                <tr key={p.id}>
                  <td>
                    <span className="serif" style={{ fontSize: 20 }}>{p.name}</span>
                  </td>
                  <td className={p.priceCents ? undefined : 'st--off'}>{price(p.priceCents)}</td>
                  <td>{num(p.storageQuotaGb, 0)} Go</td>
                  <td>{minutesToHours(p.liveQuotaMinutes)} h</td>
                  <td>{minutesToHours(p.aiQuotaMinutes)} h</td>
                  <td>{num(p.memberQuota, 0)}</td>
                  <td>{churchCount(p.name)}</td>
                  <td className="right">
                    <button className="btn btn--sm" onClick={() => startEdit(p)} disabled={editing !== null}>
                      Modifier
                    </button>
                  </td>
                </tr>
              ),
            )}
            {editing === NEW && editRow(NEW, true, 0)}
          </tbody>
        </table>
        {plans.loading && !plans.data && <div className="table-empty">Chargement…</div>}
      </div>

      {editing && (
        <div className="banner banner--info">
          <span>
            {editing === NEW
              ? 'Le nouveau plan sera proposé à l’inscription des églises.'
              : `Les nouveaux quotas s’appliquent immédiatement aux ${churchCount(editingPlan?.name ?? '')} églises du plan ${editingPlan?.name ?? ''}.`}
            {error && <span className="form-error" style={{ marginLeft: 12 }}>{error}</span>}
          </span>
          <div className="row">
            <button className="btn btn--sm" style={{ borderColor: '#c9b89e' }} onClick={() => setEditing(null)}>
              Annuler
            </button>
            <button className="btn btn--sm btn--ochre" onClick={() => void save()} disabled={busy}>
              Enregistrer
            </button>
          </div>
        </div>
      )}

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div className="card card-pad kpi" style={{ gap: 6 }}>
          <span className="label muted">Heures IA consommées</span>
          <span className="value">{minutesToHours(sum('ai'))} h</span>
        </div>
        <div className="card card-pad kpi" style={{ gap: 6 }}>
          <span className="label muted">Heures de direct</span>
          <span className="value">{minutesToHours(sum('live'))} h</span>
        </div>
        <div className="card card-pad kpi" style={{ gap: 6 }}>
          <span className="label muted">Stockage total</span>
          <span className="value">{bytesToGo(sum('storage'))} Go</span>
        </div>
      </div>
    </>
  );
}
