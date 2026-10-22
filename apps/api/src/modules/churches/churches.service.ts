import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StaffRole, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChurchDto, UpdateChurchDto } from './dto/church.dto';

const TRIAL_DAYS = 30;

const publicSelect = {
  id: true,
  name: true,
  slug: true,
  logoKey: true,
  description: true,
  sourceLanguage: true,
  targetLanguages: true,
} as const;

@Injectable()
export class ChurchesService {
  constructor(private readonly prisma: PrismaService) {}

  /** L'utilisateur qui crée l'église en devient le Church Admin. */
  async create(userId: string, dto: CreateChurchDto) {
    const existingStaff = await this.prisma.churchStaff.findUnique({ where: { userId } });
    if (existingStaff) {
      throw new ConflictException('Ce compte est déjà rattaché à une église');
    }
    await this.prisma.plan.findUniqueOrThrow({ where: { id: dto.planId } });

    const slug = await this.uniqueSlug(dto.name);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const church = await tx.church.create({
        data: {
          name: dto.name.trim(),
          slug,
          description: dto.description,
          sourceLanguage: dto.sourceLanguage,
          targetLanguages: dto.targetLanguages,
        },
        select: publicSelect,
      });
      await tx.churchStaff.create({
        data: { userId, churchId: church.id, role: StaffRole.ADMIN },
      });
      await tx.subscription.create({
        data: {
          churchId: church.id,
          planId: dto.planId,
          status: SubscriptionStatus.TRIAL,
          startAt: now,
          endAt: new Date(now.getTime() + TRIAL_DAYS * 86_400_000),
        },
      });
      return church;
    });
  }

  search(q?: string) {
    return this.prisma.church.findMany({
      where: {
        status: 'ACTIVE',
        ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      select: publicSelect,
      orderBy: { name: 'asc' },
      take: 50,
    });
  }

  async findOne(churchId: string) {
    const church = await this.prisma.church.findUnique({
      where: { id: churchId },
      select: {
        ...publicSelect,
        staff: {
          where: { role: StaffRole.PREACHER, status: 'ACTIVE' },
          select: { id: true, bio: true, photoKey: true, user: { select: { name: true } } },
        },
        _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
      },
    });
    if (!church) throw new NotFoundException('Église introuvable');
    return church;
  }

  update(churchId: string, dto: UpdateChurchDto) {
    return this.prisma.church.update({ where: { id: churchId }, data: dto, select: publicSelect });
  }

  private async uniqueSlug(name: string) {
    const base =
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 60) || 'eglise';
    let slug = base;
    for (let i = 2; await this.prisma.church.findUnique({ where: { slug } }); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }
}
