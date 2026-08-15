import { createHmac } from 'crypto';

/**
 * Проверка подписи параметров запуска мини-приложения ВК.
 * Алгоритм совпадает с пакетом vk-launch-params (HMAC-SHA256, base64url).
 * @see https://dev.vk.ru/mini-apps/development/launch-params
 */
export function verifyVkLaunchParams(
  params: Record<string, string>,
  secretKey: string,
): boolean {
  const sign = params.sign;
  if (!sign || Object.keys(params).length === 0) {
    return false;
  }

  const entries = Object.entries(params)
    .filter(([k]) => k !== 'sign' && k !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b));

  const queryString = entries
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const computed = createHmac('sha256', secretKey)
    .update(queryString)
    .digest('base64url');

  return computed === sign;
}
