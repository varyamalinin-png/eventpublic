import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { RedisService } from './redis/redis.service';
import { RedisIoAdapter } from './ws/redis-io.adapter';
import { createLogger } from './shared/utils/logger';

const logger = createLogger('Main');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN')?.split(',') || '*',
    credentials: true,
  });

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  const redisService = app.get(RedisService);
  app.useWebSocketAdapter(new RedisIoAdapter(app, redisService));

  // Слушаем на всех интерфейсах (0.0.0.0), чтобы быть доступным с устройств в локальной сети
  await app.listen(port, '0.0.0.0');
  logger.info(`🚀 Backend listening on port ${port} (0.0.0.0)`);
}

bootstrap();
