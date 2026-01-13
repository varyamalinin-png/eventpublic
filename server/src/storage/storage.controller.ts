import { Controller, Get, All, Param, Res, Req, NotFoundException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { StorageService } from './storage.service';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('StorageController');

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {
    logger.info('✅ StorageController initialized');
  }

  // КРИТИЧЕСКИ ВАЖНО: Используем параметр пути для catch-all роута
  // В NestJS нужно использовать :path(*) для catch-all роутов с несколькими сегментами
  @Get(':path(*)')
  async serveFile(@Param('path') path: string, @Req() req: Request, @Res() res: Response) {
    try {
      // КРИТИЧЕСКИ ВАЖНО: path уже содержит путь без /storage/
      // Например, для /storage/events/user/file.jpg, path будет "events/user/file.jpg"
      // Но если path содержит слэши, они будут в параметре
      const filePath = path || '';
      
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

