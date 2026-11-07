import { Controller, Get, All, Param, Query, Res, Req, NotFoundException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { StorageService } from './storage.service';
import { ImageVariantService } from './image-variant.service';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('StorageController');

@Controller('storage')
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly imageVariants: ImageVariantService,
  ) {
    logger.info('✅ StorageController initialized');
  }

  // КРИТИЧЕСКИ ВАЖНО: Используем параметр пути для catch-all роута
  // В NestJS нужно использовать :path(*) для catch-all роутов с несколькими сегментами
  @Get(':path(*)')
  async serveFile(
    @Param('path') path: string,
    @Query('w') requestedWidth: string | undefined,
    @Query('format') requestedFormat: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      // КРИТИЧЕСКИ ВАЖНО: path уже содержит путь без /storage/
      // Например, для /storage/events/user/file.jpg, path будет "events/user/file.jpg"
      // Но если path содержит слэши, они будут в параметре
      const filePath = path || '';

      /**
       * ?w=<ширина> отдаёт уменьшенный вариант.
       *
       * Ради этого и заведено: списку не нужна картинка 2048 px, а в памяти
       * телефона она стоит 16 МБ (ширина × высота × 4 байта) вне зависимости
       * от веса файла. Готовые варианты лежат в кэше на диске, так что
       * пересжатие происходит один раз на картинку и ширину.
       */
      /**
       * ?format=jpeg нужен превью ссылок в мессенджерах: телеграм, ВК и вотсап
       * не рисуют WebP в карточке ссылки — заголовок с описанием показываются,
       * а фото нет. og:image указывает сюда, в приложении формат не меняется.
       */
      const width = ImageVariantService.normalizeWidth(requestedWidth);
      const format = ImageVariantService.normalizeFormat(requestedFormat);
      if (width) {
        const cached = await this.imageVariants.readCached(filePath, width, format);
        if (cached) {
          res.setHeader('Content-Type', ImageVariantService.mimeFor(format));
          res.setHeader('Content-Length', cached.length.toString());
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.send(cached);
          return;
        }
      }

      logger.info(`📥 GET /storage/${filePath} -> MinIO key: ${filePath}`);
      logger.debug(`📥 Request URL: ${req.url}, path param: ${path}, filePath: ${filePath}`);

      // Получаем S3 клиент из StorageService
      const s3Client = this.storageService.s3;
      const bucket = this.storageService.bucket;

      if (!s3Client || !bucket) {
        logger.error('S3 client or bucket not available');
        throw new NotFoundException('Storage not configured');
      }

      // Пытаемся получить файл из MinIO
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: filePath, // Используем очищенный путь
      });

      try {
        const response = await s3Client.send(command);
        
        // Устанавливаем заголовки
        if (response.ContentType) {
          res.setHeader('Content-Type', response.ContentType);
        }
        if (response.ContentLength) {
          res.setHeader('Content-Length', response.ContentLength.toString());
        }
        if (response.CacheControl) {
          res.setHeader('Cache-Control', response.CacheControl);
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }

        // Отправляем файл
        const stream = response.Body as any;
        if (width) {
          // Для уменьшённого варианта нужен весь файл целиком — sharp не умеет
          // работать с потоком по частям. Оригиналы по-прежнему отдаются
          // потоком, без буферизации.
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(chunk as Buffer);
          }
          const source = Buffer.concat(chunks);
          const resized = await this.imageVariants.build(filePath, source, width, format);
          if (resized) {
            res.setHeader('Content-Type', ImageVariantService.mimeFor(format));
            res.setHeader('Content-Length', resized.length.toString());
            res.send(resized);
          } else {
            // Не картинка, или она и так меньше запрошенного — отдаём как есть.
            res.setHeader('Content-Length', source.length.toString());
            res.send(source);
          }
          logger.info(`✅ File served: /storage/${filePath}?w=${width}&format=${format}`);
          return;
        }
        if (stream && typeof stream.pipe === 'function') {
          stream.pipe(res);
        } else {
          // Если это Buffer, отправляем напрямую
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          res.send(buffer);
        }

        logger.info(`✅ File served: /storage/${filePath}`);
      } catch (error: any) {
        logger.error(`❌ Error serving file /storage/${filePath}:`, error?.message);
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
          throw new NotFoundException('File not found');
        }
        throw error;
      }
    } catch (error) {
      logger.error(`❌ Error in serveFile:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('File not found');
    }
  }
}

