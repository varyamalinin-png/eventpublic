import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { RedisService } from './redis/redis.service';
import { RedisIoAdapter } from './ws/redis-io.adapter';
import { createLogger } from './shared/utils/logger';
import { StorageService } from './storage/storage.service';
import { ImageVariantService } from './storage/image-variant.service';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { LegacyDomainInterceptor } from './shared/interceptors/legacy-domain.interceptor';

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

  // Базовые защитные HTTP-заголовки (nosniff, frameguard, HSTS, скрытие X-Powered-By и т.п.).
  // CSP и Cross-Origin-Resource-Policy отключены намеренно: это JSON API, а не HTML-сервер,
  // и /storage/* отдаёт медиа кросс-доменно (веб-клиент грузит картинки с другого origin) —
  // дефолтные строгие CSP/CORP блокировали бы именно этот сценарий.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );

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
  app.useGlobalInterceptors(new LegacyDomainInterceptor());

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
    const imageVariants = app.get(ImageVariantService);
    
    if (!storageService) {
      logger.warn('⚠️ StorageService not found, storage middleware not registered');
    } else {
      logger.info('✅ StorageService found, registering middleware...');
      const expressApp = app.getHttpAdapter().getInstance();
      
      // Используем /storage для обработки всех подпутей
      expressApp.use('/storage', async (req: any, res: any, next: any) => {
        try {
          // req.url содержит и путь, и query-строку. Ключ в MinIO — только
          // путь: раньше сюда попадало «файл.webp?w=400» целиком, и любой
          // запрос с параметром отдавал 404.
          const fullPath = req.url || req.path;
          const pathOnly = fullPath.split('?')[0];
          const filePath = pathOnly.startsWith('/storage/')
            ? pathOnly.replace('/storage/', '')
            : pathOnly.startsWith('/storage')
              ? pathOnly.replace('/storage', '')
              : pathOnly.startsWith('/')
                ? pathOnly.slice(1)
                : pathOnly;

          /**
           * ?w=<ширина> — уменьшенный вариант картинки.
           *
           * В памяти телефона картинка занимает ширина × высота × 4 байта, а не
           * свой вес в файле: фото 2048 px стоит 16 МБ независимо от того, что
           * весит 300 КБ. Лента держит их десятками, и iOS убивает приложение
           * за превышение лимита памяти. Списку хватает 400 px — это 0,6 МБ.
           *
           * Уменьшаем на лету и кладём результат в кэш на диске, поэтому
           * работает и для уже загруженных картинок: ссылки прежние, меняется
           * только параметр.
           */
          /**
           * ?format=jpeg — то же изображение, но в JPEG. Нужен превью ссылок:
           * телеграм, ВК и вотсап не рисуют WebP в карточке ссылки, и фото
           * просто не появляется, хотя заголовок с описанием видны. Сюда
           * указывает og:image; в приложении формат остаётся прежним.
           */
          const width = ImageVariantService.normalizeWidth(req.query?.w);
          const format = ImageVariantService.normalizeFormat(req.query?.format);
          if (width) {
            const cached = await imageVariants.readCached(filePath, width, format);
            if (cached) {
              res.setHeader('Content-Type', ImageVariantService.mimeFor(format));
              res.setHeader('Content-Length', cached.length.toString());
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
              res.setHeader('Access-Control-Allow-Origin', '*');
              return res.send(cached);
            }
          }

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
          if (width) {
            // sharp не умеет работать с потоком по частям, поэтому для
            // уменьшения читаем файл целиком. Оригиналы по-прежнему уходят
            // потоком, без буферизации.
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
              chunks.push(chunk as Buffer);
            }
            const source = Buffer.concat(chunks);
            const resized = await imageVariants.build(filePath, source, width, format);
            if (resized) {
              res.setHeader('Content-Type', ImageVariantService.mimeFor(format));
              res.setHeader('Content-Length', resized.length.toString());
              return res.send(resized);
            }
            // Не картинка, либо она и так меньше запрошенного — отдаём как есть.
            res.setHeader('Content-Length', source.length.toString());
            return res.send(source);
          }
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

  // В разработке слушаем все интерфейсы: иначе приложение с телефона не достанет
  // сервер на ноутбуке по локальной сети.
  //
  // На проде — только localhost. Наружу всё равно ходит nginx, а 0.0.0.0 означало,
  // что API доступен на :4000 напрямую: мимо nginx, мимо его белого списка
  // префиксов, мимо TLS и мимо заголовков безопасности. Держал это один ufw —
  // одна строчка правил между открытым API и интернетом.
  const host = configService.get<string>('NODE_ENV') === 'production' ? '127.0.0.1' : '0.0.0.0';
  await app.listen(port, host);
  logger.info(`🚀 Backend listening on port ${port} (${host})`);
}

bootstrap();
