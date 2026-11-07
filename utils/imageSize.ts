import { PixelRatio } from 'react-native';

/**
 * Ссылка на картинку нужного размера.
 *
 * Картинка занимает в памяти ширина × высота × 4 байта — вне зависимости от
 * того, сколько весит файл. Фото события хранится крупным, и в аватарке 40 px
 * оно всё равно стоило бы мегабайты. Из-за этого приложение через четверть часа
 * листания вылетало: iOS убивает процесс за превышение лимита памяти.
 *
 * Сервер умеет отдавать уменьшенный вариант по ?w=<ширина> (см.
 * ImageVariantService), поэтому здесь достаточно посчитать, какая ширина нужна
 * на самом деле: размер на экране, умноженный на плотность пикселей.
 *
 * Список ширин совпадает с серверным — произвольные значения там всё равно
 * округляются вверх до ближайшей разрешённой.
 */
const WIDTHS = [200, 400, 600, 800, 1200];

/** Выше трёх плотность не поднимаем: разница уже не видна, а память растёт вдвое. */
const MAX_SCALE = 3;

export function sizedImage(
  url: string | null | undefined,
  displayWidth: number,
): string | undefined {
  if (!url) return undefined;
  // Внешние картинки не трогаем: параметр поймёт только наше хранилище.
  if (!url.includes('/storage/')) return url;
  // Уже с параметрами — не вмешиваемся.
  if (url.includes('?')) return url;
  if (!displayWidth || displayWidth <= 0) return url;

  const needed = Math.ceil(displayWidth * Math.min(PixelRatio.get(), MAX_SCALE));
  const width = WIDTHS.find(candidate => candidate >= needed) ?? WIDTHS[WIDTHS.length - 1];
  return `${url}?w=${width}`;
}
