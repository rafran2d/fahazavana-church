import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class StartLiveDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  /** Audio seul par défaut (bande passante mobile) */
  @IsOptional()
  @IsBoolean()
  withVideo?: boolean;
}
