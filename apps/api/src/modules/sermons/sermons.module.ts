import { Module } from '@nestjs/common';
import { SermonsController } from './sermons.controller';
import { SermonsService } from './sermons.service';

@Module({ controllers: [SermonsController], providers: [SermonsService] })
export class SermonsModule {}
