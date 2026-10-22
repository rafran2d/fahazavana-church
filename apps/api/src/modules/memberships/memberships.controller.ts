import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChurchRoles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types/auth.types';
import { MembershipsService } from './memberships.service';

@ApiTags('memberships')
@ApiBearerAuth()
@Controller()
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Post('churches/:churchId/follow')
  follow(@CurrentUser() user: AuthUser, @Param('churchId', ParseUUIDPipe) churchId: string) {
    return this.memberships.follow(user.id, churchId);
  }

  @Delete('churches/:churchId/follow')
  @HttpCode(204)
  async unfollow(
    @CurrentUser() user: AuthUser,
    @Param('churchId', ParseUUIDPipe) churchId: string,
  ) {
    await this.memberships.unfollow(user.id, churchId);
  }

  @Get('me/memberships')
  mine(@CurrentUser() user: AuthUser) {
    return this.memberships.listMine(user.id);
  }

  @Get('churches/:churchId/members')
  @ChurchRoles(StaffRole.ADMIN)
  members(@Param('churchId', ParseUUIDPipe) churchId: string) {
    return this.memberships.listForChurch(churchId);
  }
}
