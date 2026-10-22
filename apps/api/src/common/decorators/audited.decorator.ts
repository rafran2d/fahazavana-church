import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'auditAction';
/** Enregistre l'action dans audit_logs après succès (AuditInterceptor). */
export const Audited = (action: string) => SetMetadata(AUDIT_KEY, action);
