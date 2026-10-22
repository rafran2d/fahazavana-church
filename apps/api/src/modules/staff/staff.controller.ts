import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffRole } from '@prisma/client';
import { Audited } from '../../common/decorators/audited.decorator';
import { ChurchRoles } from '../../common/decorators/roles.decorator';
import { CreatePreacherDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

@ApiTags('staff')
@ApiBearerAuth()
@Controller('churches/:churchId/staff')
@ChurchRoles(StaffRole.ADMIN)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(@Param('churchId', ParseUUIDPipe) churchId: string) {
    return this.staff.list(churchId);
  }

  @Post('preachers')
  @Audited('staff.preacher.create')
  createPreacher(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Body() dto: CreatePreacherDto,
  ) {
    return this.staff.createPreacher(churchId, dto);
  }

  @Patch(':staffId')
  @Audited('staff.update')
  update(
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staff.update(churchId, staffId, dto);
  }
}
