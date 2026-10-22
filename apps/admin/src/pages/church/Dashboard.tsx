import { Link } from 'react-router-dom';
import { Churches } from '../../api/endpoints';
import { useChurch } from '../../components/ChurchLayout';
import { ErrorNote, QuotaCard } from '../../components/ui';
import { duration, langName, sinceMinutes } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { NoSubscriptionBanner } from './Subscription';

const QUOTA_TITLES = { live: 'Direct', ai: 'Transcription & traduction IA', storage: 'Stockage', members: 'Membres' };

export function Dashboard() {
  const { churchId, quotas, noSubscription } = useChurch();
  const lives = useAsync(() => Churches.activeLives(churchId), [churchId]);
  const sermons = useAsync(() => Churches.sermons(churchId), [churchId]);

  return (
    <>
      <h1 className="h1">Tableau de bord</h1>
      {noSubscription && <NoSubscriptionBanner />}

      {lives.data?.map((l) => (
        <div key={l.id} className="live-hero">
          <div className="row" style={{ gap: 16 }}>
            <span className="badge-live">EN DIRECT</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="title">{l.title}</span>
              <span className="meta">
                {l.preacher.user.name} · {sinceMinutes(l.startedAt)} · {l.hasVideo ? 'audio + vidéo' : 'audio'}
              </span>
            </div>
          </div>
          <Link to="/eglise/directs" style={{ fontSize: 14, color: 'var(--gold)', fontWeight: 600 }}>
            Gérer le direct →
          </Link>
        </div>
      ))}

      {quotas.length > 0 && (
        <div className="kpis">
          {quotas.map((q) => (
            <QuotaCard key={q.key} q={q} label={QUOTA_TITLES[q.key]} />
          ))}
        </div>
      )}

      <div className="table">
        <div className="card-head">
          <span>Dernières prédications</span>
          <Link to="/eglise/predications" style={{ fontSize: 14, fontWeight: 600 }}>
            Tout voir
          </Link>
        </div>
        {sermons.error ? (
          <div style={{ padding: 16 }}>
            <ErrorNote message={sermons.error.message} onRetry={sermons.reload} />
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Prédicateur</th>
                <th>Durée</th>
                <th>Langues</th>
              </tr>
            </thead>
            <tbody>
              {sermons.data?.items.slice(0, 5).map((s) => (
                <tr key={s.id}>
                  <td className="wrap">{s.title}</td>
                  <td>{s.preacher.user.name}</td>
                  <td>{duration(s.durationS)}</td>
                  <td title={[s.originalLanguage, ...s.translations.filter((t) => t.status === 'DONE').map((t) => t.targetLanguage)].map(langName).join(', ')}>
                    {[s.originalLanguage, ...s.translations.filter((t) => t.status === 'DONE').map((t) => t.targetLanguage)]
                      .map((c) => c.toUpperCase())
                      .join(' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {sermons.data && sermons.data.items.length === 0 && (
          <div className="table-empty">Aucune prédication publiée pour l'instant. Elles apparaissent ici à la fin de chaque direct.</div>
        )}
        {sermons.loading && !sermons.data && <div className="table-empty">Chargement…</div>}
      </div>

      <div className="row">
        <Link to="/eglise/predicateurs" className="btn">
          Gérer les prédicateurs →
        </Link>
        <Link to="/eglise/predications" className="btn">
          Voir les prédications →
        </Link>
      </div>
    </>
  );
}
