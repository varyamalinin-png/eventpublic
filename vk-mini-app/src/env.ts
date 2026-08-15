export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';

export const MAIN_WEB_URL =
  import.meta.env.VITE_MAIN_WEB_URL?.replace(/\/$/, '') || 'https://iwent.ru';

/** Публичная политика конфиденциальности на основном сайте */
export const PRIVACY_POLICY_URL = `${MAIN_WEB_URL}/privacy`;

/** Соцссылки в витрине (можно переопределить в .env) */
export const TELEGRAM_URL =
  import.meta.env.VITE_TELEGRAM_URL?.replace(/\/$/, '').trim() ||
  'https://t.me/iwentapp';

export const VK_COMMUNITY_URL =
  import.meta.env.VITE_VK_COMMUNITY_URL?.replace(/\/$/, '').trim() ||
  'https://vk.ru/club237398722';

export const VK_GROUP_ID = Number(import.meta.env.VITE_VK_GROUP_ID || 0);

/** Опционально: URL скрина/обложки для витрины (png/jpg/webp), например загруженный в Object Storage */
export const BRAND_HERO_IMAGE_URL =
  (import.meta.env.VITE_BRAND_HERO_URL || '').trim() || '';
