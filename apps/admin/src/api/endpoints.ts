import { api } from './client';
import type {
  ActiveLive,
  ActiveStatus,
  AdminChurch,
  AdminStats,
  AuditEntry,
  ChurchDetail,
  ChurchMember,
  ChurchPublic,
  Me,
  Page,
  Plan,
  SermonSummary,
  StaffMember,
  TokenPair,
  Usage,
} from './types';

export type PlanInput = Omit<Plan, 'id' | 'currency'>;

export const Auth = {
  login: (email: string, password: string) => api.post<TokenPair>('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post<TokenPair>('/auth/register', { name, email, password }),
  logout: (refreshToken: string) => api.post<void>('/auth/logout', { refreshToken }),
  me: () => api.get<Me>('/me'),
};

export const Plans = {
  /** Du plus petit au plus grand, d'après les quotas (les prix peuvent être encore à 0). */
  list: () =>
    api
      .get<Plan[]>('/plans')
      .then((plans) =>
        [...plans].sort(
          (a, b) => a.memberQuota - b.memberQuota || a.storageQuotaGb - b.storageQuotaGb || a.priceCents - b.priceCents,
        ),
      ),
  create: (input: PlanInput) => api.post<Plan>('/admin/plans', input),
  update: (id: string, input: Partial<PlanInput>) => api.patch<Plan>(`/admin/plans/${id}`, input),
};

export const Churches = {
  create: (input: {
    name: string;
    description?: string;
    sourceLanguage: string;
    targetLanguages: string[];
    planId: string;
  }) => api.post<ChurchPublic>('/churches', input),
  get: (churchId: string) => api.get<ChurchDetail>(`/churches/${churchId}`),
  usage: (churchId: string) => api.get<Usage>(`/churches/${churchId}/usage`),
  staff: (churchId: string) => api.get<StaffMember[]>(`/churches/${churchId}/staff`),
  createPreacher: (
    churchId: string,
    input: { name: string; email: string; temporaryPassword: string; bio?: string },
  ) => api.post<StaffMember>(`/churches/${churchId}/staff/preachers`, input),
  updateStaff: (churchId: string, staffId: string, input: { status?: ActiveStatus; bio?: string }) =>
    api.patch<StaffMember>(`/churches/${churchId}/staff/${staffId}`, input),
  members: (churchId: string) => api.get<ChurchMember[]>(`/churches/${churchId}/members`),
  sermons: (churchId: string, cursor?: string | null) =>
    api.get<Page<SermonSummary>>(
      `/churches/${churchId}/sermons${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  unpublishSermon: (churchId: string, sermonId: string) =>
    api.del<{ id: string; unpublished: true }>(`/churches/${churchId}/sermons/${sermonId}`),
  activeLives: (churchId: string) => api.get<ActiveLive[]>(`/churches/${churchId}/lives/active`),
  stopLive: (churchId: string, liveId: string) => api.post<unknown>(`/churches/${churchId}/lives/${liveId}/stop`),
};

export const Admin = {
  churches: () => api.get<AdminChurch[]>('/admin/churches'),
  stats: () => api.get<AdminStats>('/admin/stats'),
  setChurchStatus: (churchId: string, status: ActiveStatus) =>
    api.patch<{ id: string; status: ActiveStatus }>(`/admin/churches/${churchId}`, { status }),
  assignSubscription: (
    churchId: string,
    input: { planId: string; startAt: string; endAt: string; amountCents?: number; paymentReference?: string },
  ) => api.post<unknown>(`/admin/churches/${churchId}/subscriptions`, input),
  auditLogs: (churchId?: string) =>
    api.get<AuditEntry[]>(`/admin/audit-logs?take=200${churchId ? `&churchId=${churchId}` : ''}`),
};
