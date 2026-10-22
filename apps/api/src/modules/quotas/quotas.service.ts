import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  LiveStatus,
  MembershipStatus,
  SubscriptionStatus,
  UsageMetric,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotaKind } from '../../common/decorators/require-quota.decorator';

const GB = 1024 ** 3;

export interface QuotaLine {
  used: number;
  limit: number;
  unit: string;
}

export interface UsageReport {
  plan: string;
  periodStart: Date;
  periodEnd: Date;
  live: QuotaLine;
  ai: QuotaLine;
  storage: QuotaLine;
  members: QuotaLine;
}

@Injectable()
export class QuotasService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveSubscription(churchId: string) {
    const now = new Date();
    return this.prisma.subscription.findFirst({
      where: {
        churchId,
        status: { in: [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE] },
        startAt: { lte: now },
        endAt: { gte: now },
      },
      include: { plan: true },
      orderBy: { startAt: 'desc' },
    });
  }

  async getUsage(churchId: string): Promise<UsageReport> {
    const sub = await this.getActiveSubscription(churchId);
    if (!sub) {
      throw new HttpException("Aucun abonnement actif pour cette église", HttpStatus.PAYMENT_REQUIRED);
    }
    const since = sub.startAt;
    const [liveRecorded, ai, storage, members, activeLives] = await Promise.all([
      this.sum(churchId, UsageMetric.LIVE_MINUTES, since),
      this.sum(churchId, UsageMetric.AI_MINUTES, since),
      this.sum(churchId, UsageMetric.STORAGE_BYTES), // stockage : cumul depuis toujours
      this.prisma.membership.count({ where: { churchId, status: MembershipStatus.ACTIVE } }),
      this.prisma.liveStream.findMany({
        where: { churchId, status: LiveStatus.LIVE, startedAt: { not: null } },
        select: { startedAt: true },
      }),
    ]);
    // Les minutes des lives en cours ne sont enregistrées qu'à la fin : on les ajoute ici.
    const runningMinutes = activeLives.reduce(
      (acc, l) => acc + Math.ceil((Date.now() - (l.startedAt as Date).getTime()) / 60_000),
      0,
    );

    return {
      plan: sub.plan.name,
      periodStart: sub.startAt,
      periodEnd: sub.endAt,
      live: { used: liveRecorded + runningMinutes, limit: sub.plan.liveQuotaMinutes, unit: 'min' },
      ai: { used: ai, limit: sub.plan.aiQuotaMinutes, unit: 'min' },
      storage: { used: storage, limit: sub.plan.storageQuotaGb * GB, unit: 'bytes' },
      members: { used: members, limit: sub.plan.memberQuota, unit: 'membres' },
    };
  }

  /** Lève 402 si le quota demandé est épuisé (ou s'il n'y a pas d'abonnement actif). */
  async assertAvailable(churchId: string, kind: QuotaKind): Promise<void> {
    const usage = await this.getUsage(churchId);
    const line = usage[kind];
    if (line.used >= line.limit) {
      throw new HttpException(
        `Quota ${kind} atteint (${line.used}/${line.limit} ${line.unit}) — passez à un plan supérieur`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  async record(
    churchId: string,
    metric: UsageMetric,
    quantity: number | bigint,
    sourceType: string,
    sourceId: string,
  ) {
    if (BigInt(quantity) === 0n) return;
    await this.prisma.usageRecord.create({
      data: { churchId, metric, quantity: BigInt(quantity), sourceType, sourceId },
    });
  }

  private async sum(churchId: string, metric: UsageMetric, since?: Date): Promise<number> {
    const agg = await this.prisma.usageRecord.aggregate({
      where: { churchId, metric, ...(since ? { recordedAt: { gte: since } } : {}) },
      _sum: { quantity: true },
    });
    return Number(agg._sum.quantity ?? 0n);
  }
}
