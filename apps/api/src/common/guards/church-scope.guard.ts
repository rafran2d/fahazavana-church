import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActiveStatus, PlatformRole, StaffRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CHURCH_ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequest } from '../types/auth.types';

/**
 * Garde globale n°3 : isolation par église.
 * Sur une route @ChurchRoles(...), vérifie que l'utilisateur fait partie du staff ACTIF
 * de l'église `:churchId` avec l'un des rôles demandés, puis expose `request.staff`.
 * Un prédicateur d'une autre église reçoit 403 avant d'atteindre le contrôleur.
 */
@Injectable()
export class ChurchScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(CHURCH_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const churchId = request.params?.churchId;
    if (!churchId) throw new BadRequestException('Paramètre churchId manquant');

    if (request.user?.platformRole === PlatformRole.SUPER_ADMIN) return true;

    const staff = await this.prisma.churchStaff.findUnique({
      where: { userId: request.user.id },
      select: { id: true, churchId: true, role: true, status: true },
    });

    if (
      !staff ||
      staff.churchId !== churchId ||
      staff.status !== ActiveStatus.ACTIVE ||
      !roles.includes(staff.role)
    ) {
      throw new ForbiddenException("Action non autorisée pour cette église");
    }

    request.staff = { id: staff.id, churchId: staff.churchId, role: staff.role };
    return true;
  }
}
