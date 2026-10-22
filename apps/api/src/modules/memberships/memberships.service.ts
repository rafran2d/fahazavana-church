import { ForbiddenException, Injectable } from '@nestjs/common';
import { MembershipStatus, PlatformRole } from '@prisma/client';
import { AuthUser } from '../../common/types/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotasService } from '../quotas/quotas.service';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotas: QuotasService,
  ) {}

  async follow(userId: string, churchId: string) {
    const current = await this.prisma.membership.findUnique({
      where: { userId_churchId: { userId, churchId } },
    });
    if (current?.status === MembershipStatus.ACTIVE) return current;

    // Le quota "membres" ne concerne que les nouveaux abonnés
    await this.quotas.assertAvailable(churchId, 'members');
    return this.prisma.membership.upsert({
      where: { userId_churchId: { userId, churchId } },
      create: { userId, churchId },
      update: { status: MembershipStatus.ACTIVE, followedAt: new Date() },
    });
  }

  async unfollow(userId: string, churchId: string) {
    await this.prisma.membership.updateMany({
      where: { userId, churchId },
      data: { status: MembershipStatus.LEFT },
    });
  }

  listMine(userId: string) {
    return this.prisma.membership.findMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      select: {
        followedAt: true,
        church: { select: { id: true, name: true, slug: true, logoKey: true } },
      },
    });
  }

  listForChurch(churchId: string) {
    return this.prisma.membership.findMany({
      where: { churchId, status: MembershipStatus.ACTIVE },
      select: { followedAt: true, user: { select: { id: true, name: true, email: true } } },
      orderBy: { followedAt: 'desc' },
    });
  }

  async isActiveMember(userId: string, churchId: string) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_churchId: { userId, churchId } },
      select: { status: true },
    });
    return m?.status === MembershipStatus.ACTIVE;
  }

  /** Lecture des contenus d'une église : membre actif, staff de l'église ou Super Admin. */
  async assertCanRead(user: AuthUser, churchId: string) {
    if (user.platformRole === PlatformRole.SUPER_ADMIN) return;
    const staff = await this.prisma.churchStaff.findFirst({
      where: { userId: user.id, churchId },
      select: { id: true },
    });
    if (staff || (await this.isActiveMember(user.id, churchId))) return;
    throw new ForbiddenException("Suivez l'église pour accéder à ses prédications");
  }
}
