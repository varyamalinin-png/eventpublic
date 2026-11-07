// Общее для страниц, которые открывает человек БЕЗ входа: ссылки на событие и
// профиль приходят в мессенджере, и получатель обычно не залогинен.

export const APP_STORE_URL = 'https://apps.apple.com/app/id6794462880';

/** Сессия лежит в localStorage (см. client/context/AuthContext). */
export function hasStoredSession(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem('auth.accessToken')) return true;
    const accounts = localStorage.getItem('auth.accounts.v1');
    return !!accounts && accounts !== '[]';
  } catch {
    // Приватный режим браузера может запретить доступ к хранилищу.
    return false;
  }
}

/** Язык берём тот же, что и приложение, иначе — язык браузера. */
export function isRussianUi(): boolean {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('@app_language') : null;
    if (saved) return saved.startsWith('ru');
  } catch {}
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.toLowerCase().startsWith('ru');
  }
  return false;
}
