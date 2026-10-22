import { useMemo, useState } from 'react';
import { Churches } from '../../api/endpoints';
import type { ProcessingStatus, SermonSummary } from '../../api/types';
import { useChurch } from '../../components/ChurchLayout';
import { ErrorNote, Modal, Status, useToast } from '../../components/ui';
import { STATUS, bytesToGo, duration, langName } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

function Processing({ status }: { status: ProcessingStatus | undefined }) {
  if (!status) return <Status tone="off">Non demandée</Status>;
  const s = STATUS[status];
  return <Status tone={s.tone}>{s.label}</Status>;
}

export function Sermons() {
  const { churchId, church, reloadUsage } = useChurch();
  const toast = useToast();
  const [items, setItems] = useState<SermonSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [preacher, setPreacher] = useState('');
  const [confirm, setConfirm] = useState<SermonSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const first = useAsync(async () => {
    const page = await Churches.sermons(churchId);
    setItems(page.items);
    setCursor(page.nextCursor);
    return page;
  }, [churchId]);

  const loadMore = async () => {
    if (!cursor) return;
    setBusy(true);
    try {
      const page = await Churches.sermons(churchId, cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async (s: SermonSummary) => {
    setBusy(true);
    try {
      await Churches.unpublishSermon(churchId, s.id);
      setItems((prev) => prev.filter((x) => x.id !== s.id));
      setConfirm(null);
      toast.show(`« ${s.title} » n'est plus visible par les membres`);
      void reloadUsage();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  // Langues cibles de l'église + celles déjà présentes sur des prédications plus anciennes
  const targets = useMemo(() => {
    const set = new Set(church.targetLanguages);
    items.forEach((s) => s.translations.forEach((t) => set.add(t.targetLanguage)));
    set.delete(church.sourceLanguage);
    return [...set];
  }, [items, church]);

  const preachers = useMemo(
    () => [...new Map(items.map((s) => [s.preacher.id, s.preacher.user.name])).entries()],
    [items],
  );
  const visible = preacher ? items.filter((s) => s.preacher.id === preacher) : items;
  const totalBytes = items.reduce((acc, s) => acc + (s.sizeBytes ?? 0), 0);

  return (
    <>
      <div className="page-head">
        <div className="page-title">
          <h1 className="h1">Prédications</h1>
          <span className="count">
            {items.length}
            {cursor ? '+' : ''} · {bytesToGo(totalBytes)} Go
          </span>
        </div>
        <select className="select input" style={{ width: 'auto', height: 42, fontSize: 14, fontWeight: 600 }} value={preacher} onChange={(e) => setPreacher(e.target.value)} aria-label="Filtrer par prédicateur">
          <option value="">Tous les prédicateurs</option>
          {preachers.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {first.error && <ErrorNote message={first.error.message} onRetry={first.reload} />}

      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Titre</th>
              <th>Prédicateur</th>
              <th>Durée</th>
              <th>Transcription {church.sourceLanguage.toUpperCase()}</th>
              {targets.map((l) => (
                <th key={l}>{langName(l)}</th>
              ))}
              <th>Taille</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className={s.processingStatus === 'FAILED' || s.translations.some((t) => t.status === 'FAILED') ? 'flagged' : undefined}>
                <td className="wrap">{s.title}</td>
                <td>{s.preacher.user.name}</td>
                <td>{duration(s.durationS)}</td>
                <td>
                  <Processing status={s.processingStatus} />
                </td>
                {targets.map((l) => (
                  <td key={l}>
                    <Processing status={s.translations.find((t) => t.targetLanguage === l)?.status} />
                  </td>
                ))}
                <td>{s.sizeBytes ? `${bytesToGo(s.sizeBytes)} Go` : '—'}</td>
                <td className="right">
                  <button className="link-btn link-btn--danger" onClick={() => setConfirm(s)}>
                    Dépublier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {first.loading && !first.data && <div className="table-empty">Chargement…</div>}
        {first.data && visible.length === 0 && <div className="table-empty">Aucune prédication publiée.</div>}
      </div>

      {cursor && (
        <button className="btn" style={{ alignSelf: 'center' }} onClick={() => void loadMore()} disabled={busy}>
          Charger plus
        </button>
      )}
      <span className="muted small">
        La transcription et les traductions sont produites automatiquement à la fin de chaque direct.
      </span>

      {confirm && (
        <Modal title="Dépublier la prédication" onClose={() => setConfirm(null)}>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            « {confirm.title} » ne sera plus visible dans la bibliothèque des membres. Les copies téléchargées sont
            retirées des téléphones à leur prochaine connexion.
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirm(null)}>
              Annuler
            </button>
            <button className="btn btn--red" onClick={() => void unpublish(confirm)} disabled={busy}>
              Dépublier
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
