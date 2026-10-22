import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest, AuthUser, StaffContext } from '../types/auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);

/** Staff de l'église courante (présent sur les routes protégées par @ChurchRoles). */
export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffContext | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().staff,
);
