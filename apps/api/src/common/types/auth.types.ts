import { PlatformRole, StaffRole } from '@prisma/client';
import { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  platformRole: PlatformRole;
}

/** Rattachement du staff chargé par ChurchScopeGuard pour l'église de la route. */
export interface StaffContext {
  id: string;
  churchId: string;
  role: StaffRole;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
  staff?: StaffContext;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: PlatformRole;
}
