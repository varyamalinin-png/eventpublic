/**
 * Публичный домен продакшена (без повторной «покупки» — только DNS + SSL + nginx).
 * Старые ссылки на iventapp.ru в БД подменяются при отдаче API.
 */
export const SITE_HOST = 'iwent.ru';
export const SITE_ORIGIN = `https://${SITE_HOST}`;
/** Префикс публичных файлов в S3/Object Storage */
export const STORAGE_URL_PREFIX = `${SITE_ORIGIN}/storage/`;

/** Нормализация URL медиа для клиентов */
export function normalizePublicMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let out = url.replace(
    /https?:\/\/[^/]+\.trycloudflare\.com\/event-app-media\//g,
    STORAGE_URL_PREFIX,
  );
  out = out.replace(/https?:\/\/(www\.)?iventapp\.ru/gi, SITE_ORIGIN);
  return out;
}
