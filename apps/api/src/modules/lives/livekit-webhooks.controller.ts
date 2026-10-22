import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { LivekitService } from './livekit.service';
import { LivesService } from './lives.service';

/** Webhooks LiveKit (signés). URL configurée dans infra/livekit/livekit.yaml. */
@ApiExcludeController()
@Public()
@Controller('webhooks/livekit')
export class LivekitWebhooksController {
  private readonly logger = new Logger(LivekitWebhooksController.name);

  constructor(
    private readonly livekit: LivekitService,
    private readonly lives: LivesService,
  ) {}

  @Post()
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>, @Headers('authorization') auth?: string) {
    const raw = req.rawBody?.toString('utf8');
    if (!raw) throw new UnauthorizedException('Corps du webhook absent');

    let event;
    try {
      event = await this.livekit.receiveWebhook(raw, auth);
    } catch {
      throw new UnauthorizedException('Signature de webhook invalide');
    }
    this.logger.debug(`Webhook ${event.event} (${event.room?.name ?? event.egressInfo?.roomName})`);
    await this.lives.handleWebhook(event);
    return { ok: true };
  }
}
