import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * GetWell RhythmX Virtual Care Backend — Entry Point.
 *
 * HIPAA Compliance Notes:
 * - Helmet enforces security headers
 * - Global validation pipe prevents injection attacks
 * - Global exception filter prevents PHI leakage in error responses
 * - TLS 1.2+ enforced at the load balancer / reverse proxy level
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // ── Security ──
  app.use(helmet());
  const corsOrigin = process.env.CORS_ORIGIN;
  const origin = corsOrigin
    ? corsOrigin.split(',').map((o) => o.trim())
    : '*';
  app.enableCors({
    origin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  });

  // ── Global Pipes & Filters ──
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── API Prefix ──
  app.setGlobalPrefix('api');

  // ── Swagger/OpenAPI Documentation ──
  const swaggerConfig = new DocumentBuilder()
    .setTitle('GetWell RhythmX Virtual Care API')
    .setDescription(
      'Backend API for the GetWell RhythmX inpatient Virtual Care platform. ' +
      'Orchestrates the "Digital Knock" workflow between Nurse Consoles, ' +
      'Amazon Chime SDK, GetWell Stay TV system, and Camera Devices.',
    )
    .setVersion('1.0.0')
    .addTag('Call Orchestration', 'Digital Knock workflow endpoints')
    .addTag('Health', 'Service health and readiness probes')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // ── Start Server ──
  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`=== GetWell RhythmX Backend running on port ${port} ===`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
