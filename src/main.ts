import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',') ?? true });
  app.enableShutdownHooks(); // graceful stop on SIGTERM (Azure restarts/scale-in)
  // Azure App Service sets PORT / WEBSITES_PORT; bind to all interfaces for containers.
  await app.listen(process.env.PORT ?? process.env.WEBSITES_PORT ?? 3000, '0.0.0.0');
}
bootstrap();
