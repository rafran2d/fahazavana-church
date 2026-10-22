import { Plans } from '../../api/endpoints';
import { useChurch } from '../../components/ChurchLayout';
import { Bar, ErrorNote } from '../../components/ui';
import { date, minutesToHours, num, quotaText } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { PlanCard } from '../Onboarding';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;

const TITLES = { live: 'Direct', ai: 'Transcription & traduction IA', storage: 'Stockage', members: 'Membres' };

export function NoSubscriptionBanner() {
  return (
    <div className="banner banner--alert">
      <span className="bang">!</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        <span className="title">Aucun abonnement actif</span>
        <span className="text">
          Les directs, les nouveaux abonnés et les traitements IA sont bloqués. Contactez l'équipe Fahazavana pour
          renouveler l'abonnement.
        </span>
      </div>
    </div>
  );
}

export function Subscription() {
  const { usage, quotas, noSubscription } = useChurch();
  const plans = useAsync(() => Plans.list(), []);
  // Ordre de la maquette : l'IA en premier, c'est le quota qui bloque le plus vite
  const ordered = [...quotas].sort((a, b) => (a.key === 'ai' ? -1 : b.key === 'ai' ? 1 : 0));
  const worst = [...quotas].sort((a, b) => b.ratio - a.ratio)[0];
  const next = plans.data?.find((p) => usage && p.name !== usage.plan && p.aiQuotaMinutes > usage.ai.limit);

  return (
    <>
      <h1 className="h1">Abonnement</h1>
      {noSubscription && <NoSubscriptionBanner />}

      {worst?.alert && (
        <div className="banner banner--alert">
          <span className="bang">!</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <span className="title">
              Quota {worst.key === 'ai' ? 'IA' : worst.label.toLowerCase()} atteint à {num(worst.ratio * 100, 0)} %
            </span>
            <span className="text">
              {worst.key === 'ai'
                ? "Une fois le quota épuisé, les nouveaux traitements de transcription et de traduction sont refusés jusqu'au renouvellement."
                : worst.key === 'live'
                  ? "Une fois le quota épuisé, les prédicateurs ne peuvent plus démarrer de direct jusqu'au renouvellement."
                  : worst.key === 'members'
                    ? "Une fois le quota atteint, de nouveaux membres ne peuvent plus suivre l'église."
                    : "Une fois le quota atteint, les nouveaux enregistrements ne peuvent plus être archivés."}
              {next && ` Le plan ${next.name} offre ${minutesToHours(next.aiQuotaMinutes)} h d'IA et ${minutesToHours(next.liveQuotaMinutes)} h de direct.`}
            </span>
          </div>
        </div>
      )}

      {usage && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="serif" style={{ fontSize: 28 }}>
                Plan {usage.plan}
              </span>
              <span className="st st--ok" style={{ fontSize: 14, fontWeight: 600 }}>
                ● Actif jusqu'au {date(usage.periodEnd)}
              </span>
            </div>
            {ordered.map((q) => (
              <div key={q.key} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 15 }}>
                  <span>{TITLES[q.key]}</span>
                  <span style={q.alert ? { fontWeight: 600, color: 'var(--red)' } : undefined}>{quotaText(q)}</span>
                </div>
                <Bar ratio={q.ratio} alert={q.alert} large />
              </div>
            ))}
            <span className="muted small">Période en cours depuis le {date(usage.periodStart)}.</span>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignSelf: 'start' }}>
            <div className="card-head">Changer de plan</div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 15, lineHeight: 1.5 }}>
              <span>
                Le changement de plan et les paiements (mobile money, virement) sont enregistrés par l'équipe
                Fahazavana. Le nouveau plan s'applique dès sa validation.
              </span>
              {SUPPORT_EMAIL && (
                <a className="btn btn--ochre" style={{ alignSelf: 'flex-start' }} href={`mailto:${SUPPORT_EMAIL}?subject=Changement%20de%20plan`}>
                  Contacter l'équipe
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <h2 className="h2" style={{ marginTop: 8 }}>
        Plans disponibles
      </h2>
      {plans.error && <ErrorNote message={plans.error.message} onRetry={plans.reload} />}
      <div className="plans">
        {plans.data?.map((p) => (
          <PlanCard key={p.id} plan={p} current={p.name === usage?.plan} tag="Plan actuel" cta={p.name === usage?.plan ? '✓ Plan actuel' : undefined} />
        ))}
      </div>
    </>
  );
}
