import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffRole } from '@prisma/client';
import { Audited } from '../../common/decorators/audited.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChurchRoles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types/auth.types';
import { ChurchesService } from './churches.service';
import { CreateChurchDto, UpdateChurchDto } from './dto/church.dto';

@ApiTags('churches')
@ApiBearerAuth()
@Controller('churches')
export class ChurchesController {
  constructor(private readonly churches: ChurchesService) {}

  @Post()
  @Audited('church.create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChurchDto) {
    return this.churches.create(user.id, dto);
  }

  @Get()
  search(@Query('q') q?: string) {
    return this.churches.search(q);
  }

  @Get(':churchId')
  findOne(@Param('churchId', ParseUUIDPipe) churchId: string) {
    return this.churches.findOne(churchId);
  }

  @Patch(':churchId')
  @ChurchRoles(StaffRole.ADMIN)
  @Audited('church.update')
  update(@Param('churchId', ParseUUIDPipe) churchId: string, @Body() dto: UpdateChurchDto) {
    return this.churches.update(churchId, dto);
  }
}
