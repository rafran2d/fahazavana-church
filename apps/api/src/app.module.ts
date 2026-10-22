import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ChurchScopeGuard } from './common/guards/church-scope.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PlatformRolesGuard } from './common/guards/platform-roles.guard';
import { QuotaGuard } from './common/guards/quota.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { envValidationSchema } from './config/env.validation';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChurchesModule } from './modules/churches/churches.module';
import { HealthController } from './modules/health/health.controller';
import { LivesModule } from './modules/lives/lives.module';
import { MediaModule } from './modules/media/media.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QuotasModule } from './modules/quotas/quotas.module';
import { SermonsModule } from './modules/sermons/sermons.module';
import { StaffModule } from './modules/staff/staff.module';
import { TranscriptsModule } from './modules/transcripts/transcripts.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationSchema }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: Number(config.get('REDIS_PORT', 6379)),
        },
      }),
    }),
    PrismaModule,
    MediaModule,
    QuotasModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    ChurchesModule,
    StaffModule,
    MembershipsModule,
    LivesModule,
    SermonsModule,
    TranscriptsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    // Ordre d'exécution : authentification → rôle plateforme → église → quota
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PlatformRolesGuard },
    { provide: APP_GUARD, useClass: ChurchScopeGuard },
    { provide: APP_GUARD, useClass: QuotaGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
