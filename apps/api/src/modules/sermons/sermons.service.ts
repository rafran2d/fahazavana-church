import { Injectable, NotFoundException } from '@nestjs/common';
import { UsageMetric } from '@prisma/client';
import { AuthUser } from '../../common/types/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { MembershipsService } from '../memberships/memberships.service';
import { QuotasService } from '../quotas/quotas.service';

const listSelect = {
  id: true,
  title: true,
  originalLanguage: true,
  durationS: true,
  sizeBytes: true,
  processingStatus: true,
  publishedAt: true,
  preacher: { select: { id: true, user: { select: { name: true } } } },
  translations: { select: { targetLanguage: true, status: true } },
} as const;

@Injectable()
export class SermonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly memberships: MembershipsService,
    private readonly quotas: QuotasService,
  ) {}

  /** Bibliothèque : prédications publiées, pagination par curseur (id). */
  async list(user: AuthUser, churchId: string, cursor?: string, take = 20) {
    await this.memberships.assertCanRead(user, churchId);
    const items = await this.prisma.sermon.findMany({
      where: { churchId, publishedAt: { not: null } },
      select: listSelect,
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > take;
    return { items: items.slice(0, take), nextCursor: hasMore ? items[take - 1].id : null };
  }

  async findOne(user: AuthUser, churchId: string, sermonId: string) {
    await this.memberships.assertCanRead(user, churchId);
    const sermon = await this.prisma.sermon.findFirst({
      where: { id: sermonId, churchId, publishedAt: { not: null } },
      select: listSelect,
    });
    if (!sermon) throw new NotFoundException('Prédication introuvable');
    return sermon;
  }

  /**
   * Tout ce qu'il faut pour l'écoute offline : URL présignée de l'audio (15 min)
   * et URLs des segments exportés, par langue demandée.
   */
  async downloadBundle(user: AuthUser, churchId: string, sermonId: string, langs: string[]) {
    await this.memberships.assertCanRead(user, churchId);
    const sermon = await this.prisma.sermon.findFirst({
      where: { id: sermonId, churchId, publishedAt: { not: null } },
      include: { transcriptions: true, translations: true },
    });
    if (!sermon?.audioKey) throw new NotFoundException('Prédication introuvable');

    const exports = new Map<string, string>();
    for (const t of sermon.transcriptions) if (t.exportKey) exports.set(t.language, t.exportKey);
    for (const t of sermon.translations) if (t.exportKey) exports.set(t.targetLanguage, t.exportKey);

    const wanted = langs.length ? langs : [...exports.keys()];
    const segments: Record<string, string> = {};
    for (const lang of wanted) {
      const key = exports.get(lang);
      if (key) segments[lang] = await this.media.presignDownload(key);
    }

    return {
      sermon: {
        id: sermon.id,
        churchId: sermon.churchId,
        title: sermon.title,
        durationS: sermon.durationS,
        sizeBytes: sermon.sizeBytes,
        publishedAt: sermon.publishedAt,
      },
      audioUrl: await this.media.presignDownload(sermon.audioKey),
      segments,
      expiresInSeconds: 900,
    };
  }

  /** Vérifie, à la reconnexion, quels contenus téléchargés sont encore accessibles. */
  async checkAccess(user: AuthUser, sermonIds: string[]) {
    const sermons = await this.prisma.sermon.findMany({
      where: { id: { in: sermonIds }, publishedAt: { not: null } },
      select: { id: true, churchId: true },
    });
    const allowed: string[] = [];
    for (const s of sermons) {
      try {
        await this.memberships.assertCanRead(user, s.churchId);
        allowed.push(s.id);
      } catch {
        /* accès retiré */
      }
    }
    return { allowed, revoked: sermonIds.filter((id) => !allowed.includes(id)) };
  }

  /** Dépublication par le Church Admin ; le stockage libéré est recrédité. */
  async unpublish(churchId: string, sermonId: string) {
    const sermon = await this.prisma.sermon.findFirst({ where: { id: sermonId, churchId } });
    if (!sermon) throw new NotFoundException('Prédication introuvable');
    await this.prisma.sermon.update({ where: { id: sermonId }, data: { publishedAt: null } });
    // TODO V2 : suppression physique différée des fichiers + crédit de stockage à ce moment-là
    if (sermon.sizeBytes) {
      await this.quotas.record(churchId, UsageMetric.STORAGE_BYTES, -sermon.sizeBytes, 'sermon', sermonId);
    }
    return { id: sermonId, unpublished: true };
  }
}
