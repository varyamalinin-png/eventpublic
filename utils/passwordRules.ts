/**
 * Правила стойкости пароля.
 *
 * Держим их отдельно, чтобы форма показывала ровно те требования, которые
 * проверит сервер (server/src/auth/dto/register.dto.ts). Разъедутся — пользователь
 * увидит зелёные галочки и получит отказ.
 */
export type PasswordRule = {
  id: 'length' | 'lower' | 'upper' | 'digit';
  test: (value: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', test: (v) => v.length >= 8 },
  { id: 'lower', test: (v) => /[a-z]/.test(v) },
  { id: 'upper', test: (v) => /[A-Z]/.test(v) },
  { id: 'digit', test: (v) => /\d/.test(v) },
];

export function checkPassword(value: string) {
  const passed = PASSWORD_RULES.filter((r) => r.test(value)).map((r) => r.id);
  return {
    passed,
    isValid: passed.length === PASSWORD_RULES.length,
    /** 0..1 — для полоски стойкости */
    strength: passed.length / PASSWORD_RULES.length,
  };
}
