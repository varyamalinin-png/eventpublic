import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { RedisService } from './redis/redis.service';
import { RedisIoAdapter } from './ws/redis-io.adapter';
import { createLogger } from './shared/utils/logger';
import { StorageService } from './storage/storage.service';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const logger = createLogger('Main');

async function bootstrap() {
  // КРИТИЧЕСКИ ВАЖНО: Отключаем body parser по умолчанию, так как он обрабатывает multipart/form-data
  // FileInterceptor (Multer) должен обрабатывать multipart/form-data БЕЗ body parser
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN')?.split(',') || '*',
    credentials: true,
  });

  // КРИТИЧЕСКИ ВАЖНО: Применяем body parser только для JSON и urlencoded, НЕ для multipart
  // Получаем Express app и применяем условный middleware ПЕРЕД регистрацией маршрутов NestJS
  const expressApp = app.getHttpAdapter().getInstance();
  
  // Применяем middleware через Express напрямую, чтобы он применялся ДО маршрутов NestJS
  expressApp.use((req: any, res: any, next: any) => {
    const contentType = (req.headers['content-type'] || '').toLowerCase();
    
    // КРИТИЧЕСКИ ВАЖНО: Пропускаем multipart/form-data - Multer должен обрабатывать его
    if (contentType.includes('multipart/form-data')) {
      return next();
    }
    
    // Для JSON применяем json parser
    if (contentType.includes('application/json') || contentType === '') {
      return json({ limit: '10mb' })(req, res, next);
    }
    
    // Для urlencoded применяем urlencoded parser
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return urlencoded({ extended: true, limit: '10mb' })(req, res, next);
    }
    
    return next();
  });

  const redisService = app.get(RedisService);
  app.useWebSocketAdapter(new RedisIoAdapter(app, redisService));

  // КРИТИЧЕСКИ ВАЖНО: Добавляем Express middleware для /storage/*
  // Используем прямой доступ к Express app через getHttpAdapter()
  try {
    logger.info('🔍 Attempting to register storage middleware...');
    const storageService = app.get(StorageService);
    
    if (!storageService) {
      logger.warn('⚠️ StorageService not found, storage middleware not registered');
    } else {
      logger.info('✅ StorageService found, registering middleware...');
      const expressApp = app.getHttpAdapter().getInstance();
      
      // Используем /storage для обработки всех подпутей
      expressApp.use('/storage', async (req: any, res: any, next: any) => {
        try {
          // req.url будет содержать /storage/events/...
          const fullPath = req.url || req.path;
          // Убираем /storage из начала
          const filePath = fullPath.startsWith('/storage/') 
            ? fullPath.replace('/storage/', '')
            : fullPath.startsWith('/storage')
              ? fullPath.replace('/storage', '')
              : fullPath.startsWith('/')
                ? fullPath.slice(1)
                : fullPath;
          
          logger.info(`📥 GET /storage${fullPath} -> MinIO key: ${filePath}`);
          
          const s3Client = storageService.s3;
          const bucket = storageService.bucket;
          
          if (!s3Client || !bucket) {
            logger.error('S3 client or bucket not available');
            return res.status(404).json({ message: 'Storage not configured' });
          }
          
          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: filePath,
          });
          
          const response = await s3Client.send(command);
          
          if (response.ContentType) {
            res.setHeader('Content-Type', response.ContentType);
          }
          if (response.ContentLength) {
            res.setHeader('Content-Length', response.ContentLength.toString());
          }
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('Access-Control-Allow-Origin', '*');
          
          const stream = response.Body as any;
          if (stream && typeof stream.pipe === 'function') {
            stream.pipe(res);
          } else {
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            res.send(buffer);
          }
          
          logger.info(`✅ File served via middleware: /storage/${filePath}`);
        } catch (error: any) {
          logger.error(`❌ Error serving file via middleware:`, error?.message);
          if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
            return res.status(404).json({ message: 'File not found' });
          }
          return res.status(500).json({ message: 'Internal server error' });
        }
      });
      logger.info('✅ Storage middleware registered for /storage/*');
    }
  } catch (error: any) {
    logger.error('❌ Failed to register storage middleware:', error?.message, error?.stack);
  }

  // Слушаем на всех интерфейсах (0.0.0.0), чтобы быть доступным с устройств в локальной сети
  await app.listen(port, '0.0.0.0');
  logger.info(`🚀 Backend listening on port ${port} (0.0.0.0)`);
}

bootstrap();
