import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '@prisma/client';
import { PLATFORM_ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../types/auth.types';

/** Garde globale n°2 : rôle plateforme (@PlatformRoles). */
@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<PlatformRole[] | undefined>(
      PLATFORM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !roles.includes(user.platformRole)) {
      throw new ForbiddenException('Rôle plateforme insuffisant');
    }
    return true;
  }
}
