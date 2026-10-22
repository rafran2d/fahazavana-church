import { useState } from 'react';
import { Admin } from '../../api/endpoints';
import { ErrorNote } from '../../components/ui';
import { actionLabel, dateTime, roleLabel } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useChurchesOverview } from '../../lib/useChurchesOverview';

export function AuditLog() {
  const [churchId, setChurchId] = useState('');
  const logs = useAsync(() => Admin.auditLogs(churchId || undefined), [churchId]);
  const churches = useChurchesOverview();

  return (
    <>
      <div className="page-head">
        <h1 className="h1">Journal d'activité</h1>
        <select className="select input" style={{ width: 'auto', height: 42, fontSize: 14, fontWeight: 600 }} value={churchId} onChange={(e) => setChurchId(e.target.value)} aria-label="Filtrer par église">
          <option value="">Toutes les églises</option>
          {churches.data?.map((r) => (
            <option key={r.church.id} value={r.church.id}>
              {r.church.name}
            </option>
          ))}
        </select>
      </div>

      {logs.error && <ErrorNote message={logs.error.message} onRetry={logs.reload} />}

      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Rôle</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.data?.map((l) => (
              <tr key={l.id}>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{dateTime(l.createdAt)}</td>
                <td>{l.actor?.name ?? 'Système'}</td>
                <td>{l.actor ? roleLabel(l.actor.platformRole, l.actor.staffRole) : 'Système'}</td>
                <td className="wrap">
                  {actionLabel(l.action)}
                  {l.church ? ` · ${l.church.name}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.loading && !logs.data && <div className="table-empty">Chargement…</div>}
        {logs.data && logs.data.length === 0 && <div className="table-empty">Aucune action enregistrée.</div>}
      </div>
      <span className="muted small">200 dernières actions sensibles réussies (créations, suspensions, directs, abonnements, plans).</span>
    </>
  );
}
