import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProcessingStatus, TranscriptPass } from '@prisma/client';

export class SegmentDto {
  @IsInt()
  @Min(0)
  seq!: number;

  @IsInt()
  @Min(0)
  startMs!: number;

  @IsInt()
  @Min(0)
  endMs!: number;

  @IsString()
  @Length(2, 3)
  language!: string;

  @IsString()
  text!: string;

  @IsBoolean()
  isSource!: boolean;
}

export class PushSegmentsDto {
  @IsEnum(TranscriptPass)
  pass!: TranscriptPass;

  /** FINAL : remplace tous les segments FINAL des langues envoyées */
  @IsOptional()
  @IsBoolean()
  replace?: boolean;

  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => SegmentDto)
  segments!: SegmentDto[];
}

export class ProcessingStatusDto {
  @IsEnum(ProcessingStatus)
  status!: ProcessingStatus;

  @IsOptional()
  @IsString()
  error?: string;
}

export class UsageReportDto {
  @IsUUID()
  churchId!: string;

  @IsIn(['AI_MINUTES'])
  metric!: 'AI_MINUTES';

  @IsInt()
  @Min(0)
  quantity!: number;

  @IsString()
  sourceType!: string;

  @IsString()
  sourceId!: string;
}
