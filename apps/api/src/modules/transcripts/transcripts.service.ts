import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ProcessingStatus, TranscriptPass, UsageMetric } from '@prisma/client';
import { AuthUser } from '../../common/types/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { MembershipsService } from '../memberships/memberships.service';
import { QuotasService } from '../quotas/quotas.service';
import { ProcessingStatusDto, PushSegmentsDto, UsageReportDto } from './dto/internal.dto';

@Injectable()
export class TranscriptsService {
  private readonly logger = new Logger(TranscriptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly memberships: MembershipsService,
    private readonly quotas: QuotasService,
  ) {}

  /** Segments d'une langue : passe finale si disponible, sinon passe live. */
  async getSegments(user: AuthUser, churchId: string, sermonId: string, lang: string) {
    await this.memberships.assertCanRead(user, churchId);
    const sermon = await this.prisma.sermon.findFirst({ where: { id: sermonId, churchId } });
    if (!sermon) throw new NotFoundException('Prédication introuvable');

    for (const pass of [TranscriptPass.FINAL, TranscriptPass.LIVE]) {
      const segments = await this.prisma.transcriptSegment.findMany({
        where: { sermonId, language: lang, pass },
        orderBy: { seq: 'asc' },
        select: { seq: true, startMs: true, endMs: true, text: true },
      });
      if (segments.length) return { sermonId, language: lang, pass, segments };
    }
    return { sermonId, language: lang, pass: null, segments: [] };
  }

  // ------------------------- routes internes (worker IA) -------------------------

  async pushSegments(sermonId: string, dto: PushSegmentsDto) {
    await this.prisma.sermon.findUniqueOrThrow({ where: { id: sermonId }, select: { id: true } });
    const rows = dto.segments.map((s) => ({ ...s, sermonId, pass: dto.pass }));

    if (dto.pass === TranscriptPass.FINAL && dto.replace) {
      const languages = [...new Set(dto.segments.map((s) => s.language))];
      await this.prisma.$transaction([
        this.prisma.transcriptSegment.deleteMany({
          where: { sermonId, pass: TranscriptPass.FINAL, language: { in: languages } },
        }),
        this.prisma.transcriptSegment.createMany({ data: rows }),
      ]);
    } else {
      await this.prisma.transcriptSegment.createMany({ data: rows, skipDuplicates: true });
    }
    return { received: rows.length };
  }

  /**
   * Fin de la passe finale : export JSON par langue dans le bucket (pour l'offline)
   * et mise à jour des statuts transcription/traduction.
   */
  async setProcessingStatus(sermonId: string, dto: ProcessingStatusDto) {
    const sermon = await this.prisma.sermon.findUniqueOrThrow({
      where: { id: sermonId },
      include: { church: true },
    });

    if (dto.status === ProcessingStatus.DONE) {
      const languages = [sermon.originalLanguage, ...sermon.church.targetLanguages];
      for (const lang of languages) {
        const segments = await this.prisma.transcriptSegment.findMany({
          where: { sermonId, language: lang, pass: TranscriptPass.FINAL },
          orderBy: { seq: 'asc' },
          select: { seq: true, startMs: true, endMs: true, text: true },
        });
        if (!segments.length) continue;
        const key = MediaService.segmentsExportKey(sermon.churchId, sermonId, lang);
        const bytes = await this.media.putJson(key, { sermonId, language: lang, segments });
        await this.quotas.record(sermon.churchId, UsageMetric.STORAGE_BYTES, bytes, 'segments_export', `${sermonId}:${lang}`);

        if (lang === sermon.originalLanguage) {
          await this.prisma.transcription.upsert({
            where: { sermonId_language: { sermonId, language: lang } },
            create: { sermonId, language: lang, status: ProcessingStatus.DONE, exportKey: key },
            update: { status: ProcessingStatus.DONE, exportKey: key, error: null },
          });
        } else {
          await this.prisma.translation.upsert({
            where: { sermonId_targetLanguage: { sermonId, targetLanguage: lang } },
            create: {
              sermonId,
              sourceLanguage: sermon.originalLanguage,
              targetLanguage: lang,
              status: ProcessingStatus.DONE,
              exportKey: key,
            },
            update: { status: ProcessingStatus.DONE, exportKey: key, error: null },
          });
        }
      }
    }

    await this.prisma.sermon.update({
      where: { id: sermonId },
      data: { processingStatus: dto.status },
    });
    if (dto.error) this.logger.warn(`Traitement IA ${sermonId} : ${dto.error}`);
    return { sermonId, status: dto.status };
  }

  async reportUsage(dto: UsageReportDto) {
    await this.quotas.record(dto.churchId, UsageMetric.AI_MINUTES, dto.quantity, dto.sourceType, dto.sourceId);
    return { recorded: true };
  }
}
