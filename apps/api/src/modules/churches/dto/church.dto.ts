import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateChurchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Code ISO 639-1 de la langue des prédications (ex. fr, mg) */
  @IsString()
  @Length(2, 3)
  sourceLanguage!: string;

  /** Une ou deux langues cibles au MVP */
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  targetLanguages!: string[];

  /** Plan choisi à l'inscription (période d'essai de 30 jours au MVP) */
  @IsUUID()
  planId!: string;
}

export class UpdateChurchDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @IsString({ each: true })
  targetLanguages?: string[];
}
