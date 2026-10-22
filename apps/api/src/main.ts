import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';

// BigInt (usage_records, size_bytes) sérialisé en nombre dans les réponses JSON
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

async function bootstrap() {
  // rawBody : nécessaire pour vérifier la signature des webhooks LiveKit
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // LiveKit envoie ses webhooks en application/webhook+json
  app.useBodyParser('json', { type: ['application/json', 'application/webhook+json'] });

  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());

  const swagger = new DocumentBuilder()
    .setTitle('Fahazavana API')
    .setDescription('Diffusion, transcription et traduction de prédications')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API prête sur http://localhost:${port}/api/v1 (docs : /docs)`, 'Bootstrap');
}

void bootstrap();
