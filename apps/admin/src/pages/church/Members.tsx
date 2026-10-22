import { useState } from 'react';
import { Churches } from '../../api/endpoints';
import { useChurch } from '../../components/ChurchLayout';
import { ErrorNote } from '../../components/ui';
import { date, num } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function Members() {
  const { churchId, usage } = useChurch();
  const members = useAsync(() => Churches.members(churchId), [churchId]);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const list = (members.data ?? []).filter((m) => !q || `${m.user.name} ${m.user.email}`.toLowerCase().includes(q));

  return (
    <>
      <div className="page-head">
        <div className="page-title">
          <h1 className="h1">Membres</h1>
          {members.data && (
            <span className="count">
              {num(members.data.length, 0)}
              {usage ? ` sur ${num(usage.members.limit, 0)}` : ''}
            </span>
          )}
        </div>
        <input className="input input--search" type="search" placeholder="Rechercher un membre…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher un membre" />
      </div>

      {members.error && <ErrorNote message={members.error.message} onRetry={members.reload} />}

      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Membre</th>
              <th>Email</th>
              <th>Suit depuis</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.user.id}>
                <td>{m.user.name}</td>
                <td className="muted">{m.user.email}</td>
                <td>{date(m.followedAt)}</td>
                <td>
                  <span className="st st--ok">● Actif</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.loading && !members.data && <div className="table-empty">Chargement…</div>}
        {members.data && list.length === 0 && (
          <div className="table-empty">{q ? 'Aucun membre ne correspond.' : "Personne ne suit encore l'église."}</div>
        )}
      </div>
    </>
  );
}
