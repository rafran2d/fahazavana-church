import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffRole } from '@prisma/client';
import { Audited } from '../../common/decorators/audited.decorator';
import { CurrentStaff, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireQuota } from '../../common/decorators/require-quota.decorator';
import { ChurchRoles } from '../../common/decorators/roles.decorator';
import { AuthUser, StaffContext } from '../../common/types/auth.types';
import { StartLiveDto } from './dto/live.dto';
import { LivesService } from './lives.service';

@ApiTags('lives')
@ApiBearerAuth()
@Controller('churches/:churchId/lives')
export class LivesController {
  constructor(private readonly lives: LivesService) {}

  /** Démarrer un live : prédicateur de l'église + quota de minutes live disponible. */
  @Post()
  @ChurchRoles(StaffRole.PREACHER)
  @RequireQuota('live')
  @Audited('live.start')
  start(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @CurrentStaff() staff: StaffContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: StartLiveDto,
  ) {
    return this.lives.start(churchId, staff, user, dto);
  }

  @Post(':liveId/stop')
  @ChurchRoles(StaffRole.PREACHER, StaffRole.ADMIN)
  @Audited('live.stop')
  stop(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Param('liveId', ParseUUIDPipe) liveId: string,
  ) {
    return this.lives.stop(churchId, liveId);
  }

  /** Lives en cours (accessible à tout utilisateur connecté, pour la page de l'église). */
  @Get('active')
  active(@Param('churchId', ParseUUIDPipe) churchId: string) {
    return this.lives.listActive(churchId);
  }

  /** Jeton spectateur (membre qui suit l'église). */
  @Post(':liveId/join')
  join(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Param('liveId', ParseUUIDPipe) liveId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lives.join(churchId, liveId, user);
  }
}
