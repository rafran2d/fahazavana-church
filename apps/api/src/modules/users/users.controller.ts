import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth.types';
import { PrismaService } from '../../prisma/prisma.service';

class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsIn(['android', 'ios'])
  platform!: string;
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        staff: { select: { id: true, churchId: true, role: true } },
        memberships: {
          where: { status: 'ACTIVE' },
          select: { church: { select: { id: true, name: true, slug: true, logoKey: true } } },
        },
      },
    });
  }

  /** Enregistre (ou rafraîchit) le jeton FCM de l'appareil. */
  @Post('devices')
  @HttpCode(204)
  async registerDevice(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { token: dto.token, platform: dto.platform, userId: user.id },
      update: { userId: user.id, platform: dto.platform, lastSeenAt: new Date() },
    });
  }
}
