import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  WebhookEvent,
  WebhookReceiver,
} from 'livekit-server-sdk';

type Grant = 'publisher' | 'subscriber' | 'agent';

/** Encapsule tous les appels à LiveKit : jetons, rooms, enregistrement, webhooks. */
@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private readonly key: string;
  private readonly secret: string;
  private readonly rooms: RoomServiceClient;
  private readonly egress: EgressClient;
  private readonly receiver: WebhookReceiver;
  readonly publicWsUrl: string;
  readonly internalWsUrl: string;

  constructor(private readonly config: ConfigService) {
    this.key = config.getOrThrow('LIVEKIT_API_KEY');
    this.secret = config.getOrThrow('LIVEKIT_API_SECRET');
    const url = config.getOrThrow<string>('LIVEKIT_URL');
    this.rooms = new RoomServiceClient(url, this.key, this.secret);
    this.egress = new EgressClient(url, this.key, this.secret);
    this.receiver = new WebhookReceiver(this.key, this.secret);
    this.publicWsUrl = config.getOrThrow('LIVEKIT_PUBLIC_WS_URL');
    this.internalWsUrl = config.getOrThrow('LIVEKIT_WS_URL');
  }

  static roomName(churchId: string, liveId: string) {
    return `church-${churchId}-live-${liveId}`;
  }

  async createToken(roomName: string, identity: string, name: string, grant: Grant) {
    const at = new AccessToken(this.key, this.secret, { identity, name, ttl: '6h' });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: grant === 'publisher',
      canSubscribe: true,
      // Seul l'agent IA publie des données (sous-titres) ; les spectateurs n'écrivent rien
      canPublishData: grant === 'agent',
      hidden: grant === 'agent',
    });
    return at.toJwt();
  }

  async createRoom(roomName: string) {
    await this.rooms.createRoom({ name: roomName, emptyTimeout: 120, maxParticipants: 0 });
  }

  async deleteRoom(roomName: string) {
    try {
      await this.rooms.deleteRoom(roomName);
    } catch (err) {
      this.logger.warn(`Suppression de la room ${roomName} impossible : ${String(err)}`);
    }
  }

  /** Enregistrement audio seul (OGG/Opus) de la room vers le bucket S3. */
  async startAudioRecording(roomName: string, key: string): Promise<string> {
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.OGG,
      filepath: key,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: this.config.getOrThrow('S3_ACCESS_KEY'),
          secret: this.config.getOrThrow('S3_SECRET_KEY'),
          region: this.config.get('S3_REGION', 'us-east-1'),
          endpoint: this.config.getOrThrow('S3_ENDPOINT'),
          bucket: this.config.getOrThrow('S3_BUCKET'),
          forcePathStyle: true,
        }),
      },
    });
    const info = await this.egress.startRoomCompositeEgress(roomName, output, { audioOnly: true });
    return info.egressId;
  }

  async stopRecording(egressId: string) {
    try {
      await this.egress.stopEgress(egressId);
    } catch (err) {
      this.logger.warn(`Arrêt de l'egress ${egressId} impossible : ${String(err)}`);
    }
  }

  /** Vérifie la signature et décode un webhook LiveKit. */
  receiveWebhook(rawBody: string, authHeader?: string): Promise<WebhookEvent> {
    return this.receiver.receive(rawBody, authHeader);
  }
}
