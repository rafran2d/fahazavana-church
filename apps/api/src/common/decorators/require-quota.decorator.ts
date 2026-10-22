import { SetMetadata } from '@nestjs/common';

export type QuotaKind = 'live' | 'ai' | 'storage' | 'members';
export const QUOTA_KEY = 'requiredQuota';
/** Vérifie le quota restant de l'église `:churchId` avant d'exécuter la route (QuotaGuard). */
export const RequireQuota = (kind: QuotaKind) => SetMetadata(QUOTA_KEY, kind);
