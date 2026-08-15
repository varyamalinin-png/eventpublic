export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';

export const MAIN_WEB_URL =
  import.meta.env.VITE_MAIN_WEB_URL?.replace(/\/$/, '') || 'https://iwent.ru';

export const PRIVACY_POLICY_URL = `${MAIN_WEB_URL}/privacy`;

export const TELEGRAM_CHANNEL_URL =
  import.meta.env.VITE_TELEGRAM_URL?.replace(/\/$/, '').trim() ||
  'https://t.me/iwentapp';

export const VK_COMMUNITY_URL =
  import.meta.env.VITE_VK_COMMUNITY_URL?.replace(/\/$/, '').trim() ||
  'https://vk.ru/club237398722';

/** Юзернейм бота без @ — для кнопки «Написать боту» (t.me/username) */
const botUser =
  import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.replace(/^@/, '').trim() || 'iwenttobot';

export const TELEGRAM_BOT_CHAT_URL = botUser
  ? `https://t.me/${botUser}`
  : TELEGRAM_CHANNEL_URL;

export const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}iwent-mark.png`;
