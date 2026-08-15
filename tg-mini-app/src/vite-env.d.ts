/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MAIN_WEB_URL?: string;
  readonly VITE_TELEGRAM_URL?: string;
  readonly VITE_VK_COMMUNITY_URL?: string;
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
