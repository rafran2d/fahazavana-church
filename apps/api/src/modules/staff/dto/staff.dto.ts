import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ActiveStatus } from '@prisma/client';

export class CreatePreacherDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  /** Mot de passe provisoire communiqué au prédicateur (changement à prévoir en V2) */
  @IsString()
  @MinLength(8)
  temporaryPassword!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsEnum(ActiveStatus)
  status?: ActiveStatus;
}
