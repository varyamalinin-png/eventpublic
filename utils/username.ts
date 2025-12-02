/**
 * Утилиты для работы с юзернеймами
 * 
 * Правила:
 * - username всегда хранится БЕЗ символа "@"
 * - "@" добавляется только при отображении
 * - username должен быть уникальным, только латинские буквы, цифры, подчеркивания
 */

/**
 * Форматирует username для отображения (добавляет @)
 * @param username - юзернейм БЕЗ @
 * @returns отформатированный юзернейм с @
 */
export const formatUsername = (username: string | undefined): string => {
  if (!username) return '@unknown';
  
  // Убираем @ если он уже есть (на случай ошибок в данных)
  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
  
  return `@${cleanUsername}`;
};

/**
 * Очищает username от символа @
 * @param username - юзернейм (может быть с @ или без)
 * @returns чистый юзернейм БЕЗ @
 */
export const cleanUsername = (username: string | undefined): string => {
  if (!username) return '';
  
  return username.startsWith('@') ? username.slice(1) : username;
};

/**
 * Валидирует username
 * @param username - юзернейм БЕЗ @
 * @returns объект с isValid и errorMessage
 */
export const validateUsername = (username: string): { isValid: boolean; errorMessage?: string } => {
  const clean = cleanUsername(username);
  
  if (!clean) {
    return { isValid: false, errorMessage: 'Юзернейм не может быть пустым' };
  }
  
  if (clean.length < 3) {
    return { isValid: false, errorMessage: 'Юзернейм должен быть не менее 3 символов' };
  }
  
  if (clean.length > 30) {
    return { isValid: false, errorMessage: 'Юзернейм должен быть не более 30 символов' };
  }
  
  // Только латинские буквы, цифры, подчеркивания
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(clean)) {
    return { isValid: false, errorMessage: 'Юзернейм может содержать только латинские буквы, цифры и подчеркивания' };
  }
  
  return { isValid: true };
};

/**
 * Нормализует username (убирает @, приводит к нижнему регистру)
 * @param username - юзернейм (может быть с @ или без)
 * @returns нормализованный юзернейм БЕЗ @ в нижнем регистре
 */
export const normalizeUsername = (username: string | undefined): string => {
  return cleanUsername(username).toLowerCase();
};

