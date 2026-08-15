import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

type ImageOptimizationOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp' | 'png' | 'auto';
};

@Injectable()
export class ImageOptimizerService {
  private readonly logger = new Logger(ImageOptimizerService.name);

  /**
   * Оптимизирует изображение с помощью sharp
   * @param buffer - исходный буфер изображения
   * @param options - опции оптимизации
   * @returns оптимизированный буфер и обновленный mimetype
   */
  async optimizeImage(
    buffer: Buffer,
    mimetype: string,
    options: ImageOptimizationOptions = {},
  ): Promise<{ buffer: Buffer; mimetype: string; size: number }> {
    try {
      // Если это не изображение, возвращаем как есть
      if (!mimetype.startsWith('image/')) {
        this.logger.debug(`File is not an image (${mimetype}), skipping optimization`);
        return { buffer, mimetype, size: buffer.length };
      }

      // Получаем метаданные изображения
      const metadata = await sharp(buffer).metadata();
      const originalSize = buffer.length;

      // Определяем опции оптимизации по умолчанию
      const maxWidth = options.maxWidth || 2048;
      const maxHeight = options.maxHeight || 2048;
      const quality = options.quality || 85;
      const format = options.format || 'auto';

      // Определяем выходной формат
      let outputFormat: 'jpeg' | 'webp' | 'png' = 'jpeg';
      let outputMimetype = 'image/jpeg';

      if (format === 'auto') {
        // Используем WebP для лучшей оптимизации, если исходное изображение не PNG с прозрачностью
        if (metadata.format !== 'png' || !metadata.hasAlpha) {
          outputFormat = 'webp';
          outputMimetype = 'image/webp';
        } else {
          // Для PNG с прозрачностью оставляем PNG, но оптимизируем
          outputFormat = 'png';
          outputMimetype = 'image/png';
        }
      } else {
        outputFormat = format;
        outputMimetype = format === 'webp' ? 'image/webp' : format === 'png' ? 'image/png' : 'image/jpeg';
      }

      // Начинаем обработку изображения.
      // .rotate() без аргументов читает EXIF Orientation, физически поворачивает
      // пиксели и убирает тег — иначе телефонные фото (особенно снятые в портрете)
      // остаются "лежащими на боку" при конвертации в WebP, чья поддержка EXIF-
      // ориентации у разных декодеров непоследовательна.
      let image = sharp(buffer).rotate();

      // Изменяем размер, если нужно
      if (metadata.width && metadata.height) {
        const needsResize = metadata.width > maxWidth || metadata.height > maxHeight;
        
        if (needsResize) {
          image = image.resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true,
          });
          this.logger.debug(
            `Resizing image from ${metadata.width}x${metadata.height} to max ${maxWidth}x${maxHeight}`,
          );
        }
      }

      // Применяем оптимизацию в зависимости от формата
      if (outputFormat === 'webp') {
        buffer = await image.webp({ quality }).toBuffer();
      } else if (outputFormat === 'png') {
        buffer = await image.png({ compressionLevel: 9, quality }).toBuffer();
      } else {
        buffer = await image.jpeg({ quality, mozjpeg: true }).toBuffer();
      }

      const optimizedSize = buffer.length;
      const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);

      this.logger.log(
        `✅ Image optimized: ${(originalSize / 1024).toFixed(1)}KB -> ${(optimizedSize / 1024).toFixed(1)}KB (${compressionRatio}% reduction), format: ${outputMimetype}`,
      );

      return {
        buffer,
        mimetype: outputMimetype,
        size: optimizedSize,
      };
    } catch (error: any) {
      // Если оптимизация не удалась, возвращаем оригинал
      this.logger.warn(`⚠️ Failed to optimize image: ${error?.message || error}, using original`);
      return { buffer, mimetype, size: buffer.length };
    }
  }

  /**
   * Оптимизирует аватар (меньший размер)
   */
  async optimizeAvatar(buffer: Buffer, mimetype: string): Promise<{ buffer: Buffer; mimetype: string; size: number }> {
    return this.optimizeImage(buffer, mimetype, {
      maxWidth: 512,
      maxHeight: 512,
      quality: 80,
      format: 'webp',
    });
  }

  /**
   * Оптимизирует медиа события
   */
  async optimizeEventMedia(buffer: Buffer, mimetype: string): Promise<{ buffer: Buffer; mimetype: string; size: number }> {
    return this.optimizeImage(buffer, mimetype, {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 85,
      format: 'auto',
    });
  }
}

