import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QUOTA_KEY, QuotaKind } from '../decorators/require-quota.decorator';
import { QuotasService } from '../../modules/quotas/quotas.service';
import { AuthenticatedRequest } from '../types/auth.types';

/** Garde globale n°4 : quota restant de l'église (@RequireQuota). Lève 402 si dépassé. */
@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly quotas: QuotasService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const kind = this.reflector.getAllAndOverride<QuotaKind | undefined>(QUOTA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!kind) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await this.quotas.assertAvailable(request.params.churchId, kind);
    return true;
  }
}
