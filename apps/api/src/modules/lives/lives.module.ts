import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AI_QUEUE } from '../queue/ai-jobs';
import { LivekitWebhooksController } from './livekit-webhooks.controller';
import { LivekitService } from './livekit.service';
import { LivesController } from './lives.controller';
import { LivesService } from './lives.service';

@Module({
  imports: [BullModule.registerQueue({ name: AI_QUEUE })],
  controllers: [LivesController, LivekitWebhooksController],
  providers: [LivesService, LivekitService],
})
export class LivesModule {}
