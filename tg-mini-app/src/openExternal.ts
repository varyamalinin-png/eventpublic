/** Открытие ссылок из Mini App (внешний браузер / клиент Telegram). */
export function openExternalUrl(url: string): void {
  const tg = window.Telegram?.WebApp;
  if (!tg?.openLink) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const isTelegramDeep =
    /^https?:\/\/(t\.me|telegram\.me|telegram\.dog)\//i.test(url) ||
    url.startsWith('tg:');
  if (isTelegramDeep && typeof tg.openTelegramLink === 'function') {
    tg.openTelegramLink(url);
    return;
  }
  tg.openLink(url, { try_instant_view: false });
}
