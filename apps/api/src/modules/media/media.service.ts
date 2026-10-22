import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Accès au stockage objet (MinIO en dev, S3 compatible en prod).
 * Le bucket est privé : les clients reçoivent uniquement des URLs présignées de courte durée.
 */
@Injectable()
export class MediaService {
  private readonly internal: S3Client;
  private readonly publicSigner: S3Client;
  readonly bucket: string;

  constructor(config: ConfigService) {
    const base = {
      region: config.get<string>('S3_REGION', 'us-east-1'),
      forcePathStyle: String(config.get('S3_FORCE_PATH_STYLE', 'true')) === 'true',
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    };
    const endpoint = config.getOrThrow<string>('S3_ENDPOINT');
    this.internal = new S3Client({ ...base, endpoint });
    // Signé avec l'hôte public pour que l'URL soit valide depuis le téléphone
    this.publicSigner = new S3Client({
      ...base,
      endpoint: config.get<string>('S3_PUBLIC_ENDPOINT') || endpoint,
    });
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
  }

  /** Clés de stockage normalisées : tout ce qui concerne une église est sous churches/{id}/ */
  static liveAudioKey(churchId: string, liveId: string) {
    return `churches/${churchId}/lives/${liveId}/audio.ogg`;
  }

  static segmentsExportKey(churchId: string, sermonId: string, lang: string) {
    return `churches/${churchId}/sermons/${sermonId}/segments.${lang}.json`;
  }

  async presignDownload(key: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(
      this.publicSigner,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async sizeOf(key: string): Promise<number> {
    const head = await this.internal.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return head.ContentLength ?? 0;
  }

  async putJson(key: string, value: unknown): Promise<number> {
    const body = Buffer.from(JSON.stringify(value));
    await this.internal.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/json',
      }),
    );
    return body.length;
  }
}
