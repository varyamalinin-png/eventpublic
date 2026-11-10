import { PixelRatio } from 'react-native';

/**
 * Ссылка на картинку нужного размера.
 *
 * Картинка занимает в памяти ширина × высота × 4 байта — вне зависимости от
 * того, сколько весит файл. Фото события хранится крупным, и в аватарке 40 px
 * оно всё равно стоило бы мегабайты. Из-за этого приложение через четверть часа
 * листания вылетало: iOS убивает процесс за превышение лимита памяти.
 *
 * Медиа живёт в публичном S3-бакете (Yandex Object Storage), и сервер при
 * загрузке кладёт рядом уменьшенные варианты `<ключ>__w<N>.webp` (см.
 * StorageService). Клиент ходит за ними НАПРЯМУЮ в бакет, минуя бэкенд:
 * так картинки не зависят от единственного сетевого маршрута до сервера —
 * у части сетей (МТС) крупные ответы через iwent.ru теряются, а до
 * storage.yandexcloud.net маршрут другой.
 *
 * Если варианта в бакете нет (старый файл, не успела генерация), ResilientImage
 * откатывается на серверный ресайз через sizedImageFallback() — тот же ?w=N
 * на iwent.ru, который генерирует вариант на лету (ImageVariantService).
 *
 * Список ширин совпадает с серверным — произвольные значения там всё равно
 * округляются вверх до ближайшей разрешённой.
 */
const WIDTHS = [200, 400, 600, 800, 1200];

/** Выше трёх плотность не поднимаем: разница уже не видна, а память растёт вдвое. */
const MAX_SCALE = 3;

/**
 * Прямой адрес бакета. Захардкожен сознательно, как и `https://iwent.ru/storage`
 * в normalizeMediaUrl: это публичный CDN-эндпоинт, а не секрет.
 */
const STORAGE_CDN_BASE = 'https://event-app-storage.storage.yandexcloud.net';
const STORAGE_PATH_MARKER = '/storage/';

/** Ключ объекта в бакете из любого нашего storage-URL (с query или без). */
function storageKeyFromUrl(url: string): string | null {
  const markerIndex = url.indexOf(STORAGE_PATH_MARKER);
  if (markerIndex === -1) return null;
  const path = url.slice(markerIndex + STORAGE_PATH_MARKER.length);
  const key = path.split('?')[0];
  return key || null;
}

function pickWidth(displayWidth: number): number {
  const needed = Math.ceil(displayWidth * Math.min(PixelRatio.get(), MAX_SCALE));
  return WIDTHS.find(candidate => candidate >= needed) ?? WIDTHS[WIDTHS.length - 1];
}

/** `events/u/abc.webp` → `events/u/abc` (расширение варианта всегда .webp). */
function stripExtension(key: string): string {
  return key.replace(/\.(webp|jpe?g|png)$/i, '');
}

/** Прямой CDN-URL уменьшенного варианта. */
export function cdnVariantUrl(key: string, width: number): string {
  return `${STORAGE_CDN_BASE}/${stripExtension(key)}__w${width}.webp`;
}

/** Серверный ресайз на лету — запасной путь, когда варианта в бакете ещё нет. */
export function sizedImageFallback(
  url: string | null | undefined,
  displayWidth: number,
): string | undefined {
  if (!url) return undefined;
  const key = storageKeyFromUrl(url);
  if (!key) return url;
  const widthMatch = /[?&]w=(\d+)/.exec(url);
  const width = widthMatch
    ? Number(widthMatch[1])
    : displayWidth > 0
      ? pickWidth(displayWidth)
      : null;
  if (!width) return url;
  return `https://iwent.ru/storage/${key}?w=${width}`;
}

/**
 * Оригинал (без уменьшения) тоже отдаём напрямую из бакета — для
 * полноэкранного просмотра, где ?w= не применяется.
 */
export function originalImageCdn(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.includes('?')) return url;
  const key = storageKeyFromUrl(url);
  if (!key) return url;
  return `${STORAGE_CDN_BASE}/${key}`;
}

export function sizedImage(
  url: string | null | undefined,
  displayWidth: number,
): string | undefined {
  if (!url) return undefined;
  // Внешние картинки не трогаем: вариант есть только у нашего хранилища.
  const key = storageKeyFromUrl(url);
  if (!key) return url;

  // Уже с серверным ?w=N — берём ту же ширину, но напрямую из бакета.
  // Прочие параметры (format=jpeg для og:image) меняют содержимое — не трогаем.
  if (url.includes('?')) {
    const widthMatch = /[?&]w=(\d+)/.exec(url);
    if (!widthMatch) return url;
    return cdnVariantUrl(key, Number(widthMatch[1]));
  }

  if (!displayWidth || displayWidth <= 0) return originalImageCdn(url);

  return cdnVariantUrl(key, pickWidth(displayWidth));
}
