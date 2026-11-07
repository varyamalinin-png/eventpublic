import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../shared/utils/logger';

const logger = createLogger('ImageVariantService');

export type ImageVariantFormat = 'webp' | 'jpeg';

/**
 * Уменьшенные варианты картинок, «на лету» и с кэшом на диске.
 *
 * Зачем: в памяти телефона картинка занимает не свой вес в файле, а
 * ширина × высота × 4 байта. Фото события хранится в 2048×2048 — это 16 МБ
 * оперативной памяти на КАЖДУЮ картинку, независимо от того, что файл весит
 * 300 КБ. Лента держит их десятками, и через четверть часа листания iOS
 * убивает приложение за превышение лимита памяти. Для строки списка хватает
 * 400 px — те же 16 МБ превращаются в 0,6 МБ.
 *
 * Почему «на лету», а не при загрузке: так же работают уже загруженные
 * картинки, а их почти сотня. Пересжимать хранилище и переписывать ссылки в
 * базе не нужно — ссылки остаются прежними, добавляется только ?w=.
 *
 * Результат кладём в WebP: он заметно меньше JPEG при том же качестве и
 * поддерживает прозрачность, так что одним форматом закрываются и фотографии,
 * и картинки с альфа-каналом.
 *
 * Единственное исключение — `format: 'jpeg'`. Он нужен для превью ссылок в
 * мессенджерах: телеграм, ВК и вотсап не показывают WebP в карточке ссылки, и
 * фото просто не появляется, хотя заголовок с описанием видны. Для og:image
 * отдаём JPEG, во всех остальных местах остаётся WebP.
 */
@Injectable()
export class ImageVariantService {
  /**
   * Разрешаем не любую ширину, а фиксированный набор.
   *
   * Произвольная ширина из запроса означала бы, что кто угодно может заставить
   * сервер сгенерировать сколько угодно вариантов одной картинки и забить диск.
   */
  private static readonly WIDTHS = [200, 400, 600, 800, 1200];

  private readonly cacheDir = path.join(process.cwd(), '.image-cache');

  /** Ближайшая разрешённая ширина, не меньше запрошенной. */
  static normalizeWidth(raw: unknown): number | null {
    const requested = Number(raw);
    if (!Number.isFinite(requested) || requested <= 0) return null;
    return (
      ImageVariantService.WIDTHS.find(width => width >= requested) ??
      ImageVariantService.WIDTHS[ImageVariantService.WIDTHS.length - 1]
    );
  }

  /** Формат из запроса; всё, кроме явного jpeg, остаётся прежним WebP. */
  static normalizeFormat(raw: unknown): ImageVariantFormat {
    const value = String(raw ?? '').toLowerCase();
    return value === 'jpeg' || value === 'jpg' ? 'jpeg' : 'webp';
  }

  static mimeFor(format: ImageVariantFormat): string {
    return format === 'jpeg' ? 'image/jpeg' : 'image/webp';
  }

  private cachePath(key: string, width: number, format: ImageVariantFormat): string {
    // Формат входит в ключ, иначе jpeg-вариант перезаписал бы webp того же размера.
    const hash = crypto.createHash('sha1').update(`${key}|${width}|${format}`).digest('hex');
    return path.join(this.cacheDir, `${hash}.${format === 'jpeg' ? 'jpg' : 'webp'}`);
  }

  async readCached(
    key: string,
    width: number,
    format: ImageVariantFormat = 'webp',
  ): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.cachePath(key, width, format));
    } catch {
      return null;
    }
  }

  /**
   * Уменьшает картинку. Возвращает null, если это не картинка или уменьшать
   * нечего — тогда вызывающий отдаёт оригинал.
   */
  async build(
    key: string,
    source: Buffer,
    width: number,
    format: ImageVariantFormat = 'webp',
  ): Promise<Buffer | null> {
    try {
      const metadata = await sharp(source).metadata();
      if (!metadata.width || !metadata.height) return null;
      // Увеличивать не станем: смысла нет, а вес вырастет. Для jpeg исключение:
      // там важен не размер, а сам формат, поэтому перекодируем в любом случае.
      if (metadata.width <= width && format !== 'jpeg') return null;

      const pipeline = sharp(source).rotate().resize({ width, withoutEnlargement: true });
      const resized = await (format === 'jpeg'
        ? pipeline.flatten({ background: '#0A0A0C' }).jpeg({ quality: 82, mozjpeg: true })
        : pipeline.webp({ quality: 82 })
      ).toBuffer();

      // Кэш пишем в фоне: ответ не должен ждать диск.
      void this.writeCache(key, width, format, resized);
      logger.debug(
        `Вариант ${width}px для ${key}: ${(source.length / 1024).toFixed(0)}КБ -> ${(resized.length / 1024).toFixed(0)}КБ`,
      );
      return resized;
    } catch (error) {
      logger.warn(`Не удалось уменьшить ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  private async writeCache(
    key: string,
    width: number,
    format: ImageVariantFormat,
    data: Buffer,
  ): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const target = this.cachePath(key, width, format);
      // Пишем через временный файл: иначе параллельный запрос может прочитать
      // недописанный вариант и показать битую картинку.
      const temporary = `${target}.${process.pid}.tmp`;
      await fs.writeFile(temporary, data);
      await fs.rename(temporary, target);
    } catch (error) {
      logger.debug(`Не удалось сохранить кэш варианта: ${(error as Error).message}`);
    }
  }
}
