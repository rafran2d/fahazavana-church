import { useEffect, useState } from 'react';
import { Churches } from '../../api/endpoints';
import type { ActiveLive } from '../../api/types';
import { useChurch } from '../../components/ChurchLayout';
import { ErrorNote, Modal, useToast } from '../../components/ui';
import { sinceMinutes } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

const REFRESH_MS = 15_000;

export function Lives() {
  const { churchId, quotas, reloadUsage } = useChurch();
  const toast = useToast();
  const lives = useAsync(() => Churches.activeLives(churchId), [churchId]);
  const [stopping, setStopping] = useState<ActiveLive | null>(null);
  const [busy, setBusy] = useState(false);
  const live = quotas.find((q) => q.key === 'live');

  // Les directs démarrent depuis l'app mobile : on rafraîchit la liste régulièrement
  useEffect(() => {
    const id = window.setInterval(() => void lives.reload(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [lives.reload]);

  const stop = async (l: ActiveLive) => {
    setBusy(true);
    try {
      await Churches.stopLive(churchId, l.id);
      setStopping(null);
      toast.show("Direct arrêté. L'enregistrement est archivé dans les prédications.");
      await lives.reload();
      void reloadUsage();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="page-title">
          <h1 className="h1">Directs</h1>
          {live && (
            <span className="count">
              {live.used} / {live.limit} h utilisées
            </span>
          )}
        </div>
      </div>

      {lives.error && <ErrorNote message={lives.error.message} onRetry={lives.reload} />}

      {lives.data?.length === 0 && (
        <div className="card center-msg">
          Aucun direct en cours. Les prédicateurs lancent les directs depuis l'application mobile ; ils apparaissent
          ici automatiquement.
        </div>
      )}

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
          <button className="btn btn--sm" style={{ background: 'var(--canvas)', color: 'var(--red)', borderColor: 'var(--canvas)' }} onClick={() => setStopping(l)}>
            ■ Arrêter le direct
          </button>
        </div>
      ))}

      {stopping && (
        <Modal title="Arrêter le direct ?" onClose={() => setStopping(null)}>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            « {stopping.title} » sera coupé pour tous les spectateurs. L'enregistrement est conservé et passe en
            transcription.
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setStopping(null)}>
              Continuer le direct
            </button>
            <button className="btn btn--red" onClick={() => void stop(stopping)} disabled={busy}>
              Arrêter
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
