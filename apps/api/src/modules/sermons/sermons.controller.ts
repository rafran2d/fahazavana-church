import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffRole } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { Audited } from '../../common/decorators/audited.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChurchRoles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types/auth.types';
import { SermonsService } from './sermons.service';

class CheckAccessDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  sermonIds!: string[];
}

@ApiTags('sermons')
@ApiBearerAuth()
@Controller()
export class SermonsController {
  constructor(private readonly sermons: SermonsService) {}

  @Get('churches/:churchId/sermons')
  list(
    @CurrentUser() user: AuthUser,
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.sermons.list(user, churchId, cursor);
  }

  @Get('churches/:churchId/sermons/:sermonId')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Param('sermonId', ParseUUIDPipe) sermonId: string,
  ) {
    return this.sermons.findOne(user, churchId, sermonId);
  }

  /** ?langs=fr,en — URLs présignées pour le téléchargement offline */
  @Get('churches/:churchId/sermons/:sermonId/download')
  download(
    @CurrentUser() user: AuthUser,
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Param('sermonId', ParseUUIDPipe) sermonId: string,
    @Query('langs') langs?: string,
  ) {
    const list = (langs ?? '').split(',').map((l) => l.trim()).filter(Boolean);
    return this.sermons.downloadBundle(user, churchId, sermonId, list);
  }

  @Delete('churches/:churchId/sermons/:sermonId')
  @ChurchRoles(StaffRole.ADMIN)
  @Audited('sermon.unpublish')
  unpublish(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Param('sermonId', ParseUUIDPipe) sermonId: string,
  ) {
    return this.sermons.unpublish(churchId, sermonId);
  }

  /** Appelé par l'app à la reconnexion pour retirer les contenus offline devenus inaccessibles. */
  @Post('me/downloads/check')
  check(@CurrentUser() user: AuthUser, @Body() dto: CheckAccessDto) {
    return this.sermons.checkAccess(user, dto.sermonIds);
  }
}
