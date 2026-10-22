import { useState } from 'react';
import { ErrorNote } from '../../components/ui';
import { minutesToHours } from '../../lib/format';
import { useChurchesOverview } from '../../lib/useChurchesOverview';

type Metric = 'ai' | 'live';

export function Usage() {
  const rows = useChurchesOverview();
  const [metric, setMetric] = useState<Metric>('ai');

  const list = (rows.data ?? [])
    .filter((r) => r.usage)
    .map((r) => ({ name: r.church.name, used: r.usage![metric].used, limit: r.usage![metric].limit }))
    .sort((a, b) => b.used - a.used);
  const max = Math.max(1, ...list.map((r) => r.used));
  const total = list.reduce((acc, r) => acc + r.used, 0);

  return (
    <>
      <h1 className="h1">Consommation {metric === 'ai' ? 'IA' : 'des directs'}</h1>
      <div className="row" style={{ gap: 8 }}>
        {(
          [
            ['ai', 'IA (h)'],
            ['live', 'Direct (h)'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`chip${metric === k ? ' on' : ''}`} onClick={() => setMetric(k)} aria-pressed={metric === k}>
            {label}
          </button>
        ))}
      </div>

      {rows.error && <ErrorNote message={rows.error.message} onRetry={rows.reload} />}

      <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {list.map((r) => (
          <div key={r.name} className="usage-row" title={`${minutesToHours(r.used)} h sur ${minutesToHours(r.limit)} h`}>
            <span className="name">{r.name}</span>
            <div className={`track${r.used / Math.max(r.limit, 1) >= 0.9 ? ' alert' : ''}`}>
              <span style={{ width: `${(r.used / max) * 100}%` }} />
            </div>
            <span style={{ textAlign: 'right' }}>{minutesToHours(r.used)} h</span>
          </div>
        ))}
        {rows.loading && !rows.data && <span className="skeleton">Chargement…</span>}
        {rows.data && list.length === 0 && <span className="muted">Aucune église avec un abonnement actif.</span>}
      </div>
      <span className="muted" style={{ fontSize: 14 }}>
        Total : {minutesToHours(total)} h · période d'abonnement en cours de chaque église. En rouge : plus de 90 % du
        quota.
      </span>
    </>
  );
}
