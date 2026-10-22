// Formes renvoyées par l'API NestJS (apps/api). À tenir alignées avec les `select` Prisma.

export type PlatformRole = 'SUPER_ADMIN' | 'USER';
export type StaffRole = 'ADMIN' | 'PREACHER';
export type ActiveStatus = 'ACTIVE' | 'SUSPENDED';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface StaffLink {
  id: string;
  churchId: string;
  role: StaffRole;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole;
  staff: StaffLink | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: Me;
}

export interface Plan {
  id: string;
  name: string;
  priceCents: number;
  currency: string;
  storageQuotaGb: number;
  liveQuotaMinutes: number;
  aiQuotaMinutes: number;
  memberQuota: number;
}

export interface QuotaLine {
  used: number;
  limit: number;
  unit: string;
}

export interface Usage {
  plan: string;
  periodStart: string;
  periodEnd: string;
  live: QuotaLine;
  ai: QuotaLine;
  storage: QuotaLine;
  members: QuotaLine;
}

export interface ChurchPublic {
  id: string;
  name: string;
  slug: string;
  logoKey: string | null;
  description: string | null;
  sourceLanguage: string;
  targetLanguages: string[];
}

export interface ChurchDetail extends ChurchPublic {
  _count: { memberships: number };
}

export interface StaffMember {
  id: string;
  role: StaffRole;
  bio: string | null;
  photoKey: string | null;
  status: ActiveStatus;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

export interface ChurchMember {
  followedAt: string;
  user: { id: string; name: string; email: string };
}

export interface SermonSummary {
  id: string;
  title: string;
  originalLanguage: string;
  durationS: number | null;
  sizeBytes: number | null;
  processingStatus: ProcessingStatus;
  publishedAt: string | null;
  preacher: { id: string; user: { name: string } };
  translations: { targetLanguage: string; status: ProcessingStatus }[];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ActiveLive {
  id: string;
  title: string;
  startedAt: string | null;
  hasVideo: boolean;
  preacher: { user: { name: string } };
}

export interface AdminChurch {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ActiveStatus;
  sourceLanguage: string;
  targetLanguages: string[];
  createdAt: string;
  subscriptions: {
    id: string;
    status: SubscriptionStatus;
    startAt: string;
    endAt: string;
    plan: Plan;
  }[];
  _count: { memberships: number; sermons: number };
}

export interface AdminStats {
  churches: number;
  users: number;
  sermons: number;
  livesInProgress: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  createdAt: string;
  targetId: string | null;
  actor: { id: string; name: string; platformRole: PlatformRole; staffRole: StaffRole | null } | null;
  church: { id: string; name: string } | null;
}
