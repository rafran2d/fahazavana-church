import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_KEY } from '../decorators/audited.decorator';
import { AuthenticatedRequest } from '../types/auth.types';

/** Journalise les actions @Audited() réussies dans audit_logs. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string | undefined>(AUDIT_KEY, context.getHandler());
    if (!action) return next.handle();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return next.handle().pipe(
      tap((result) => {
        const targetId =
          result && typeof result === 'object' && 'id' in result
            ? String((result as { id: unknown }).id)
            : undefined;
        this.prisma.auditLog
          .create({
            data: {
              actorId: request.user?.id,
              churchId: request.params?.churchId,
              action,
              targetId,
              metadata: { method: request.method, path: request.originalUrl },
            },
          })
          .catch((err: unknown) => this.logger.warn(`Audit non enregistré : ${String(err)}`));
      }),
    );
  }
}
