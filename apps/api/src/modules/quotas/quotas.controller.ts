import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffRole } from '@prisma/client';
import { ChurchRoles } from '../../common/decorators/roles.decorator';
import { QuotasService } from './quotas.service';

@ApiTags('quotas')
@ApiBearerAuth()
@Controller('churches/:churchId/usage')
export class QuotasController {
  constructor(private readonly quotas: QuotasService) {}

  /** Consommation du plan en cours (tableau de bord Church Admin). */
  @Get()
  @ChurchRoles(StaffRole.ADMIN)
  getUsage(@Param('churchId', ParseUUIDPipe) churchId: string) {
    return this.quotas.getUsage(churchId);
  }
}
