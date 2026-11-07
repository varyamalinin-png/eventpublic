/**
 * Транспортная ошибка (сеть недоступна, таймаут, оборванное соединение) —
 * в отличие от ответа сервера с кодом 401/403/500.
 *
 * Различать их критично: при транспортной ошибке сохранённую сессию трогать
 * НЕЛЬЗЯ, иначе плохая связь или VPN выкидывают человека из аккаунта.
 * Раньше проверки были расписаны в четырёх местах по списку текстов и
 * ТАЙМАУТ в этот список не входил: services/api.ts бросает 'Network timeout',
 * а искали 'Network request failed' / 'Failed to fetch' / 'No connection'.
 * Из-за этого таймаут считался «неизвестной ошибкой» и сессия стиралась.
 *
 * Основной признак — status === 0: именно его services/api.ts проставляет
 * всем транспортным сбоям. Проверка по тексту оставлена как запасная.
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;

  // ApiError с транспортным сбоем: сервер не ответил вовсе.
  if (error.status === 0) return true;

  if (error.name === 'AbortError') return true;

  const message = String(error.message ?? '').toLowerCase();
  return (
    message.includes('network timeout') ||
    message.includes('no connection') ||
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    message.includes('tls') ||
    message.includes('secure connection')
  );
}
