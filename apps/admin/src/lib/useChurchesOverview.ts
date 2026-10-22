import { ApiError } from '../api/client';
import { Admin, Churches } from '../api/endpoints';
import type { AdminChurch, Usage } from '../api/types';
import { isAlert } from './format';
import { useAsync } from './useAsync';

export type ChurchHealth = 'active' | 'trial' | 'low' | 'expired' | 'suspended';

export interface ChurchRow {
  church: AdminChurch;
  /** null : aucun abonnement actif (402) */
  usage: Usage | null;
  plan: string | null;
  health: ChurchHealth;
}

export const HEALTH: Record<ChurchHealth, { label: string; tone: 'ok' | 'warn' | 'bad' | 'off' }> = {
  active: { label: '● Actif', tone: 'ok' },
  trial: { label: '● Essai', tone: 'ok' },
  low: { label: '● Quota bas', tone: 'warn' },
  expired: { label: '● Expiré', tone: 'bad' },
  suspended: { label: '● Suspendue', tone: 'off' },
};

export function healthOf(church: AdminChurch, usage: Usage | null): ChurchHealth {
  if (church.status === 'SUSPENDED') return 'suspended';
  if (!usage) return 'expired';
  if (isAlert(usage.live) || isAlert(usage.ai)) return 'low';
  return church.subscriptions[0]?.status === 'TRIAL' ? 'trial' : 'active';
}

/**
 * Vue Super Admin : églises + consommation de chacune.
 * MVP : un appel /usage par église (quelques dizaines d'églises) ; à remplacer par un
 * endpoint agrégé si le nombre d'églises grandit.
 */
export function useChurchesOverview() {
  return useAsync(async (): Promise<ChurchRow[]> => {
    const churches = await Admin.churches();
    return Promise.all(
      churches.map(async (church) => {
        let usage: Usage | null = null;
        try {
          usage = await Churches.usage(church.id);
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 402)) throw e;
        }
        return { church, usage, plan: usage?.plan ?? null, health: healthOf(church, usage) };
      }),
    );
  }, []);
}
