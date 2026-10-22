import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActiveStatus, PaymentStatus, PlatformRole, SubscriptionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Audited } from '../../common/decorators/audited.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PlatformRoles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

class AssignSubscriptionDto {
  @IsUUID()
  planId!: string;

  @Type(() => Date)
  @IsDate()
  startAt!: Date;

  @Type(() => Date)
  @IsDate()
  endAt!: Date;

  /** Paiement saisi manuellement au MVP (mobile money, virement…) */
  @IsOptional()
  @IsInt()
  @Min(0)
  amountCents?: number;

  @IsOptional()
  @IsString()
  paymentReference?: string;
}

class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsInt()
  @Min(1)
  storageQuotaGb!: number;

  @IsInt()
  @Min(1)
  liveQuotaMinutes!: number;

  @IsInt()
  @Min(1)
  aiQuotaMinutes!: number;

  @IsInt()
  @Min(1)
  memberQuota!: number;
}

class UpdatePlanDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  storageQuotaGb?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  liveQuotaMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  aiQuotaMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  memberQuota?: number;
}

class UpdateChurchStatusDto {
  @IsEnum(ActiveStatus)
  status!: ActiveStatus;
}

class AuditQueryDto {
  @IsOptional()
  @IsUUID()
  churchId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller()
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liste publique des plans (écran d'inscription d'une église). */
  @Public()
  @Get('plans')
  plans() {
    return this.prisma.plan.findMany({ orderBy: { priceCents: 'asc' } });
  }

  @Get('admin/churches')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  churches() {
    return this.prisma.church.findMany({
      include: {
        subscriptions: { orderBy: { startAt: 'desc' }, take: 1, include: { plan: true } },
        _count: { select: { memberships: true, sermons: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Le Super Admin active un abonnement après réception du paiement (MVP : saisie manuelle). */
  @Post('admin/churches/:churchId/subscriptions')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @Audited('subscription.assign')
  async assign(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Body() dto: AssignSubscriptionDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { churchId, status: { in: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE] } },
        data: { status: SubscriptionStatus.CANCELED },
      });
      const sub = await tx.subscription.create({
        data: {
          churchId,
          planId: dto.planId,
          status: SubscriptionStatus.ACTIVE,
          startAt: dto.startAt,
          endAt: dto.endAt,
        },
      });
      if (dto.amountCents !== undefined) {
        await tx.payment.create({
          data: {
            subscriptionId: sub.id,
            amountCents: dto.amountCents,
            status: PaymentStatus.PAID,
            reference: dto.paymentReference,
            paidAt: new Date(),
          },
        });
      }
      return sub;
    });
  }

  @Post('admin/plans')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @Audited('plan.create')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.prisma.plan.create({ data: { ...dto, name: dto.name.trim() } });
  }

  /** Les nouveaux quotas s'appliquent immédiatement aux abonnements en cours de ce plan. */
  @Patch('admin/plans/:planId')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @Audited('plan.update')
  updatePlan(@Param('planId', ParseUUIDPipe) planId: string, @Body() dto: UpdatePlanDto) {
    return this.prisma.plan.update({ where: { id: planId }, data: dto });
  }

  /** Suspension : l'église disparaît de la recherche publique. */
  @Patch('admin/churches/:churchId')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  @Audited('church.status')
  updateChurchStatus(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Body() dto: UpdateChurchStatusDto,
  ) {
    return this.prisma.church.update({
      where: { id: churchId },
      data: { status: dto.status },
      select: { id: true, name: true, status: true },
    });
  }

  /** Journal des actions sensibles (@Audited), le plus récent d'abord. */
  @Get('admin/audit-logs')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  async auditLogs(@Query() query: AuditQueryDto) {
    const logs = await this.prisma.auditLog.findMany({
      where: query.churchId ? { churchId: query.churchId } : {},
      orderBy: { createdAt: 'desc' },
      take: query.take ?? 100,
    });
    // actor_id et church_id ne sont pas des relations Prisma : résolution des noms en deux requêtes
    const ids = (key: 'actorId' | 'churchId') => [
      ...new Set(logs.map((l) => l[key]).filter((v): v is string => !!v)),
    ];
    const [users, churches] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: ids('actorId') } },
        select: { id: true, name: true, platformRole: true, staff: { select: { role: true } } },
      }),
      this.prisma.church.findMany({
        where: { id: { in: ids('churchId') } },
        select: { id: true, name: true },
      }),
    ]);
    const userById = new Map(users.map((u) => [u.id, u]));
    const churchById = new Map(churches.map((c) => [c.id, c]));
    return logs.map((l) => {
      const actor = l.actorId ? userById.get(l.actorId) : undefined;
      return {
        id: l.id,
        action: l.action,
        createdAt: l.createdAt,
        targetId: l.targetId,
        actor: actor
          ? {
              id: actor.id,
              name: actor.name,
              platformRole: actor.platformRole,
              staffRole: actor.staff?.role ?? null,
            }
          : null,
        church: l.churchId ? (churchById.get(l.churchId) ?? null) : null,
      };
    });
  }

  @Get('admin/stats')
  @PlatformRoles(PlatformRole.SUPER_ADMIN)
  async stats() {
    const [churches, users, sermons, lives] = await Promise.all([
      this.prisma.church.count(),
      this.prisma.user.count(),
      this.prisma.sermon.count({ where: { publishedAt: { not: null } } }),
      this.prisma.liveStream.count({ where: { status: 'LIVE' } }),
    ]);
    return { churches, users, sermons, livesInProgress: lives };
  }
}
