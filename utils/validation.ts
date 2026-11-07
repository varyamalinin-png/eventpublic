/**
 * Валидаторы полей формы входа/регистрации.
 *
 * Правила username/phone продублированы из server/src/auth/dto/register.dto.ts —
 * разъедутся, пользователь увидит зелёную галочку и получит отказ от сервера.
 * Возвращаем ключ ошибки (или null), а не готовый текст: текст берётся из
 * t.validation на месте вызова, чтобы не тащить сюда контекст языка.
 */

export type ValidationKey =
  | 'required'
  | 'emailInvalid'
  | 'usernameEmpty'
  | 'usernameTooShort'
  | 'usernameTooLong'
  | 'usernameChars'
  | 'phoneRequired'
  | 'phoneTooShort'
  | 'mustAgreeToTerms';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_.]+$/;

export function validateEmail(value: string): ValidationKey | null {
  const v = value.trim();
  if (!v) return 'required';
  if (!EMAIL_RE.test(v)) return 'emailInvalid';
  return null;
}

export function validateUsername(value: string): ValidationKey | null {
  const v = value.trim();
  if (!v) return 'usernameEmpty';
  if (v.length < 3) return 'usernameTooShort';
  if (v.length > 32) return 'usernameTooLong';
  if (!USERNAME_RE.test(v)) return 'usernameChars';
  return null;
}

/**
 * `digits` — только национальный номер, без кода страны.
 *
 * Пустое поле — норма: телефон необязателен (Apple 5.1.1(v), отказ по сборке 3).
 * Ругаемся только на начатый, но слишком короткий номер.
 */
export function validatePhoneDigits(digits: string): ValidationKey | null {
  if (!digits) return null;
  if (digits.length < 5) return 'phoneTooShort';
  return null;
}
