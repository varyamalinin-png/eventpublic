/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MAIN_WEB_URL?: string;
  readonly VITE_VK_GROUP_ID?: string;
  /** Скрин или баннер для блока витрины (полный https URL) */
  readonly VITE_BRAND_HERO_URL?: string;
  readonly VITE_TELEGRAM_URL?: string;
  readonly VITE_VK_COMMUNITY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
