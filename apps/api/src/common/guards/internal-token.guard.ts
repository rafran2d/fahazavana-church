import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

/** Protège les routes internes appelées par le worker IA (en-tête X-Internal-Token). */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = Buffer.from(String(request.headers['x-internal-token'] ?? ''));
    const expected = Buffer.from(this.config.getOrThrow<string>('INTERNAL_API_TOKEN'));
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Jeton interne invalide');
    }
    return true;
  }
}
