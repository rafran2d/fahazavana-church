import { createContext, useContext, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ApiError } from '../api/client';
import { Churches } from '../api/endpoints';
import type { ChurchDetail, Usage } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { monthName, quotaView, type QuotaView } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { ErrorNote, QuotaLine } from './ui';

interface ChurchCtx {
  churchId: string;
  church: ChurchDetail;
  usage: Usage | null;
  /** 402 de l'API : aucun abonnement actif */
  noSubscription: boolean;
  quotas: QuotaView[];
  reloadUsage: () => Promise<void>;
}

const Ctx = createContext<ChurchCtx | null>(null);
export function useChurch() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useChurch hors de ChurchLayout');
  return c;
}

export function quotasOf(usage: Usage | null | undefined): QuotaView[] {
  if (!usage) return [];
  return [
    quotaView('live', usage.live),
    quotaView('ai', usage.ai),
    quotaView('storage', usage.storage),
    quotaView('members', usage.members),
  ];
}

const NAV = [
  ['/eglise', 'Tableau de bord'],
  ['/eglise/predications', 'Prédications'],
  ['/eglise/directs', 'Directs'],
  ['/eglise/predicateurs', 'Prédicateurs'],
  ['/eglise/membres', 'Membres'],
  ['/eglise/abonnement', 'Abonnement'],
] as const;

export function ChurchLayout() {
  const { user, logout } = useAuth();
  const churchId = user!.staff!.churchId;
  const church = useAsync(() => Churches.get(churchId), [churchId]);
  const usage = useAsync(
    () =>
      Churches.usage(churchId).catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 402) return null;
        throw e;
      }),
    [churchId],
  );

  let body: ReactNode;
  if (church.error) body = <ErrorNote message={church.error.message} onRetry={church.reload} />;
  else if (!church.data) body = <p className="skeleton">Chargement…</p>;
  else body = <Outlet />;

  const quotas = quotasOf(usage.data);
  const ctx: ChurchCtx | null = church.data
    ? {
        churchId,
        church: church.data,
        usage: usage.data ?? null,
        noSubscription: usage.data === null,
        quotas,
        reloadUsage: usage.reload,
      }
    : null;

  return (
    <div className="shell">
      <aside className="sidebar sidebar--church">
        <div className="sidebar-brand">
          <span className="avatar avatar--church" style={{ width: 36, height: 36, fontSize: 18 }}>
            {church.data?.name[0] ?? '·'}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="name">{church.data?.name ?? '…'}</span>
            <span className="sub">
              {usage.data ? `Plan ${usage.data.plan}` : usage.data === null ? 'Sans abonnement' : ' '}
            </span>
          </div>
        </div>
        {NAV.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/eglise'} className="nav-link">
            {label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          {quotas.length > 0 && (
            <div className="quota-box">
              <span className="eyebrow">Quotas · {monthName()}</span>
              {quotas.map((q) => (
                <QuotaLine key={q.key} q={q} />
              ))}
            </div>
          )}
          <div className="sidebar-user">
            <span className="muted" title={user!.email}>
              {user!.name}
            </span>
            <button onClick={() => void logout()}>Déconnexion</button>
          </div>
        </div>
      </aside>
      <main className="main">{ctx ? <Ctx.Provider value={ctx}>{body}</Ctx.Provider> : body}</main>
    </div>
  );
}
