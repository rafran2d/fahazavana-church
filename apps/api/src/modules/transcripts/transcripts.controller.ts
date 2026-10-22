import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { InternalTokenGuard } from '../../common/guards/internal-token.guard';
import { AuthUser } from '../../common/types/auth.types';
import { ProcessingStatusDto, PushSegmentsDto, UsageReportDto } from './dto/internal.dto';
import { TranscriptsService } from './transcripts.service';

@ApiTags('transcripts')
@ApiBearerAuth()
@Controller()
export class TranscriptsController {
  constructor(private readonly transcripts: TranscriptsService) {}

  /** ?lang=fr — segments horodatés pour l'affichage synchronisé */
  @Get('churches/:churchId/sermons/:sermonId/segments')
  segments(
    @CurrentUser() user: AuthUser,
    @Param('churchId', ParseUUIDPipe) churchId: string,
    @Param('sermonId', ParseUUIDPipe) sermonId: string,
    @Query('lang') lang: string,
  ) {
    return this.transcripts.getSegments(user, churchId, sermonId, lang);
  }

  // --------- Routes internes : worker IA uniquement (X-Internal-Token) ---------

  @Public()
  @UseGuards(InternalTokenGuard)
  @ApiExcludeEndpoint()
  @Post('internal/sermons/:sermonId/segments')
  push(@Param('sermonId', ParseUUIDPipe) sermonId: string, @Body() dto: PushSegmentsDto) {
    return this.transcripts.pushSegments(sermonId, dto);
  }

  @Public()
  @UseGuards(InternalTokenGuard)
  @ApiExcludeEndpoint()
  @Post('internal/sermons/:sermonId/processing')
  @HttpCode(200)
  status(@Param('sermonId', ParseUUIDPipe) sermonId: string, @Body() dto: ProcessingStatusDto) {
    return this.transcripts.setProcessingStatus(sermonId, dto);
  }

  @Public()
  @UseGuards(InternalTokenGuard)
  @ApiExcludeEndpoint()
  @Post('internal/usage')
  usage(@Body() dto: UsageReportDto) {
    return this.transcripts.reportUsage(dto);
  }
}
