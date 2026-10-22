import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { LiveStatus, PlatformRole, ProcessingStatus, StaffRole, UsageMetric } from '@prisma/client';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { WebhookEvent } from 'livekit-server-sdk';
import { AuthUser, StaffContext } from '../../common/types/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { MembershipsService } from '../memberships/memberships.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QuotasService } from '../quotas/quotas.service';
import { AI_QUEUE, AiJob, LiveAttachJob, SermonTranscribeJob } from '../queue/ai-jobs';
import { StartLiveDto } from './dto/live.dto';
import { LivekitService } from './livekit.service';

@Injectable()
export class LivesService {
  private readonly logger = new Logger(LivesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly livekit: LivekitService,
    private readonly quotas: QuotasService,
    private readonly memberships: MembershipsService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
    @InjectQueue(AI_QUEUE) private readonly aiQueue: Queue,
  ) {}

  /** Le prédicateur démarre un live pour SON église (vérifié par ChurchScopeGuard + QuotaGuard). */
  async start(churchId: string, staff: StaffContext | undefined, user: AuthUser, dto: StartLiveDto) {
    if (!staff || staff.role !== StaffRole.PREACHER) {
      throw new ForbiddenException('Seul un prédicateur de cette église peut démarrer un live');
    }
    const running = await this.prisma.liveStream.findFirst({
      where: { churchId, status: { in: [LiveStatus.STARTING, LiveStatus.LIVE] } },
    });
    if (running) throw new ConflictException('Un live est déjà en cours pour cette église');

    const liveId = randomUUID();
    const roomName = LivekitService.roomName(churchId, liveId);
    const live = await this.prisma.liveStream.create({
      data: {
        id: liveId,
        churchId,
        preacherId: staff.id,
        title: dto.title,
        hasVideo: dto.withVideo ?? false,
        roomName,
      },
    });
    // La prédication existe dès le live (non publiée) : les segments live s'y rattachent
    const church = await this.prisma.church.findUniqueOrThrow({ where: { id: churchId } });
    await this.prisma.sermon.create({
      data: {
        churchId,
        preacherId: staff.id,
        liveStreamId: live.id,
        title: dto.title,
        originalLanguage: church.sourceLanguage,
        processingStatus: ProcessingStatus.PROCESSING,
      },
    });
    await this.livekit.createRoom(roomName);

    const token = await this.livekit.createToken(roomName, `preacher-${user.id}`, user.email, 'publisher');
    return { liveId: live.id, roomName, wsUrl: this.livekit.publicWsUrl, token };
  }

  /** Jeton spectateur : réservé aux membres qui suivent l'église (ou à son staff). */
  async join(churchId: string, liveId: string, user: AuthUser) {
    const live = await this.prisma.liveStream.findFirst({
      where: { id: liveId, churchId, status: { in: [LiveStatus.STARTING, LiveStatus.LIVE] } },
      include: {
        church: { select: { sourceLanguage: true, targetLanguages: true } },
        sermon: { select: { id: true } },
      },
    });
    if (!live) throw new NotFoundException('Live introuvable ou terminé');

    const isStaff = await this.prisma.churchStaff.findFirst({
      where: { userId: user.id, churchId },
      select: { id: true },
    });
    const allowed =
      user.platformRole === PlatformRole.SUPER_ADMIN ||
      !!isStaff ||
      (await this.memberships.isActiveMember(user.id, churchId));
    if (!allowed) throw new ForbiddenException("Suivez l'église pour rejoindre ses lives");

    const token = await this.livekit.createToken(
      live.roomName,
      `member-${user.id}`,
      user.email,
      'subscriber',
    );
    return {
      liveId: live.id,
      // Permet à un membre arrivé en retard de charger les segments déjà transcrits
      sermonId: live.sermon?.id,
      title: live.title,
      wsUrl: this.livekit.publicWsUrl,
      token,
      subtitlesTopic: 'subtitles',
      languages: [live.church.sourceLanguage, ...live.church.targetLanguages],
    };
  }

  async stop(churchId: string, liveId: string) {
    const live = await this.prisma.liveStream.findFirst({ where: { id: liveId, churchId } });
    if (!live) throw new NotFoundException('Live introuvable');
    // La suite (statut, sermon, jobs) est déclenchée par les webhooks room_finished / egress_ended
    if (live.egressId) await this.livekit.stopRecording(live.egressId);
    await this.livekit.deleteRoom(live.roomName);
    return { liveId, status: 'stopping' };
  }

  listActive(churchId: string) {
    return this.prisma.liveStream.findMany({
      where: { churchId, status: LiveStatus.LIVE },
      select: {
        id: true,
        title: true,
        startedAt: true,
        hasVideo: true,
        preacher: { select: { user: { select: { name: true } } } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Webhooks LiveKit : ils font foi pour les changements de statut
  // ---------------------------------------------------------------------------

  async handleWebhook(event: WebhookEvent) {
    const roomName = event.room?.name ?? event.egressInfo?.roomName;
    if (!roomName?.startsWith('church-')) return;
    const live = await this.prisma.liveStream.findUnique({
      where: { roomName },
      include: { church: true },
    });
    if (!live) return;

    switch (event.event) {
      case 'track_published':
        if (live.status === LiveStatus.STARTING) await this.onFirstTrack(live.id);
        break;
      case 'room_finished':
        await this.onRoomFinished(live.id);
        break;
      case 'egress_ended':
        await this.onRecordingReady(live.id);
        break;
      default:
        break;
    }
  }

  private async onFirstTrack(liveId: string) {
    const live = await this.prisma.liveStream.update({
      where: { id: liveId },
      data: { status: LiveStatus.LIVE, startedAt: new Date() },
      include: { church: true, sermon: { select: { id: true } } },
    });
    this.logger.log(`Live ${live.id} en direct (${live.church.name})`);

    try {
      const egressId = await this.livekit.startAudioRecording(
        live.roomName,
        MediaService.liveAudioKey(live.churchId, live.id),
      );
      await this.prisma.liveStream.update({ where: { id: live.id }, data: { egressId } });
    } catch (err) {
      this.logger.error(`Enregistrement impossible pour le live ${live.id} : ${String(err)}`);
    }

    // Sous-titres en direct seulement s'il reste du quota IA
    try {
      await this.quotas.assertAvailable(live.churchId, 'ai');
      const job: LiveAttachJob = {
        liveId: live.id,
        sermonId: live.sermon!.id,
        churchId: live.churchId,
        roomName: live.roomName,
        wsUrl: this.livekit.internalWsUrl,
        agentToken: await this.livekit.createToken(live.roomName, `ai-agent-${live.id}`, 'Sous-titres', 'agent'),
        sourceLanguage: live.church.sourceLanguage,
        targetLanguages: live.church.targetLanguages,
      };
      await this.aiQueue.add(AiJob.LiveAttach, job, { jobId: `live-${live.id}`, removeOnComplete: true });
    } catch (err) {
      this.logger.warn(`Sous-titres désactivés pour le live ${live.id} : ${String(err)}`);
    }

    await this.notifications.notifyFollowers(live.churchId, {
      type: 'LIVE_STARTED',
      title: `${live.church.name} est en direct`,
      message: live.title,
      data: { churchId: live.churchId, liveId: live.id },
    });
  }

  private async onRoomFinished(liveId: string) {
    const live = await this.prisma.liveStream.findUniqueOrThrow({ where: { id: liveId } });
    if (live.status === LiveStatus.ENDED) return;
    const endedAt = new Date();
    await this.prisma.liveStream.update({
      where: { id: liveId },
      data: { status: live.startedAt ? LiveStatus.ENDED : LiveStatus.FAILED, endedAt },
    });
    if (live.startedAt) {
      const minutes = Math.ceil((endedAt.getTime() - live.startedAt.getTime()) / 60_000);
      await this.quotas.record(live.churchId, UsageMetric.LIVE_MINUTES, minutes, 'live_stream', live.id);
    }
  }

  /** L'enregistrement est dans le bucket : création de la prédication + passe IA finale. */
  private async onRecordingReady(liveId: string) {
    const live = await this.prisma.liveStream.findUniqueOrThrow({
      where: { id: liveId },
      include: { church: true, sermon: true },
    });
    if (!live.sermon || live.sermon.audioKey) return; // déjà traité

    const audioKey = MediaService.liveAudioKey(live.churchId, live.id);
    let sizeBytes = 0;
    try {
      sizeBytes = await this.media.sizeOf(audioKey);
    } catch {
      this.logger.error(`Fichier ${audioKey} introuvable après egress_ended`);
      await this.prisma.sermon.update({
        where: { id: live.sermon.id },
        data: { processingStatus: ProcessingStatus.FAILED },
      });
      return;
    }
    const durationS =
      live.startedAt && live.endedAt
        ? Math.round((live.endedAt.getTime() - live.startedAt.getTime()) / 1000)
        : null;

    const sermon = await this.prisma.sermon.update({
      where: { id: live.sermon.id },
      data: {
        audioKey,
        sizeBytes: BigInt(sizeBytes),
        durationS,
        publishedAt: new Date(),
        processingStatus: ProcessingStatus.PENDING,
      },
    });
    await this.quotas.record(live.churchId, UsageMetric.STORAGE_BYTES, sizeBytes, 'sermon', sermon.id);

    try {
      await this.quotas.assertAvailable(live.churchId, 'ai');
      const job: SermonTranscribeJob = {
        sermonId: sermon.id,
        churchId: live.churchId,
        audioKey,
        sourceLanguage: live.church.sourceLanguage,
        targetLanguages: live.church.targetLanguages,
      };
      await this.aiQueue.add(AiJob.SermonTranscribe, job, {
        jobId: `sermon-${sermon.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
      });
    } catch (err) {
      this.logger.warn(`Passe IA finale non lancée pour ${sermon.id} : ${String(err)}`);
    }

    await this.notifications.notifyFollowers(live.churchId, {
      type: 'NEW_SERMON',
      title: `Nouvelle prédication — ${live.church.name}`,
      message: live.title,
      data: { churchId: live.churchId, sermonId: sermon.id },
    });
  }

  /** Coupe proprement les lives qui dépassent le quota de minutes (vérifié chaque minute). */
  @Interval(60_000)
  async enforceLiveQuotas() {
    const lives = await this.prisma.liveStream.findMany({
      where: { status: LiveStatus.LIVE },
      select: { id: true, churchId: true },
    });
    for (const live of lives) {
      try {
        const usage = await this.quotas.getUsage(live.churchId);
        if (usage.live.used >= usage.live.limit) {
          this.logger.warn(`Quota live atteint : arrêt du live ${live.id}`);
          await this.stop(live.churchId, live.id);
        }
      } catch (err) {
        this.logger.warn(`Contrôle quota live ${live.id} : ${String(err)}`);
      }
    }
  }
}
