import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MembershipStatus } from '@prisma/client';
import * as admin from 'firebase-admin';
import { PrismaService } from '../../prisma/prisma.service';

export interface PushMessage {
  type: 'LIVE_STARTED' | 'NEW_SERMON' | 'CHURCH_INFO';
  title: string;
  message: string;
  data?: Record<string, string>;
}

/**
 * Notifications en base + push FCM.
 * Sans FIREBASE_SERVICE_ACCOUNT_JSON (dev), les push sont seulement journalisés.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private fcm?: admin.messaging.Messaging;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const json = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!json) {
      this.logger.warn('FCM désactivé (FIREBASE_SERVICE_ACCOUNT_JSON vide) : push journalisés');
      return;
    }
    const app = admin.apps.length
      ? admin.app()
      : admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
    this.fcm = app.messaging();
  }

  /** Notifie tous les membres actifs qui suivent l'église. */
  async notifyFollowers(churchId: string, push: PushMessage) {
    const members = await this.prisma.membership.findMany({
      where: { churchId, status: MembershipStatus.ACTIVE },
      select: { userId: true },
    });
    const userIds = members.map((m) => m.userId);
    if (!userIds.length) return;

    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: push.type,
        title: push.title,
        message: push.message,
        data: push.data ?? {},
      })),
    });

    const tokens = (
      await this.prisma.deviceToken.findMany({
        where: { userId: { in: userIds } },
        select: { token: true },
      })
    ).map((t) => t.token);

    await this.sendPush(tokens, push);
  }

  private async sendPush(tokens: string[], push: PushMessage) {
    if (!tokens.length) return;
    if (!this.fcm) {
      this.logger.log(`[push simulé] ${push.title} → ${tokens.length} appareil(s)`);
      return;
    }
    // FCM accepte 500 jetons par envoi
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const res = await this.fcm.sendEachForMulticast({
        tokens: batch,
        notification: { title: push.title, body: push.message },
        data: { type: push.type, ...(push.data ?? {}) },
      });
      // Nettoyage des jetons devenus invalides
      const invalid = res.responses
        .map((r, idx) => (!r.success && r.error?.code === 'messaging/registration-token-not-registered' ? batch[idx] : null))
        .filter((t): t is string => t !== null);
      if (invalid.length) {
        await this.prisma.deviceToken.deleteMany({ where: { token: { in: invalid } } });
      }
    }
  }

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }
}
