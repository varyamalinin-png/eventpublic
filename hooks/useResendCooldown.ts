import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_COOLDOWN_SECONDS = 120;

/**
 * Обратный отсчёт до следующей разрешённой отправки кода.
 *
 * Сервер сам ограничивает частоту и в отказе возвращает retryAfterSeconds —
 * его и берём за истину, а не локальный таймер: иначе после перезапуска экрана
 * кнопка снова выглядит доступной, а запрос всё равно отклоняется.
 */
export function useResendCooldown(initialSeconds = 0) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      return;
    }
    if (timer.current) return;
    timer.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [secondsLeft]);

  const start = useCallback((seconds = DEFAULT_COOLDOWN_SECONDS) => {
    setSecondsLeft(Math.max(0, Math.ceil(seconds)));
  }, []);

  /** Достаёт retryAfterSeconds из отказа сервера, если он там есть. */
  const startFromError = useCallback((error: any) => {
    const retry = error?.body?.retryAfterSeconds ?? error?.body?.message?.retryAfterSeconds;
    setSecondsLeft(typeof retry === 'number' && retry > 0 ? Math.ceil(retry) : DEFAULT_COOLDOWN_SECONDS);
  }, []);

  const label = secondsLeft > 0
    ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
    : '';

  return { secondsLeft, isCoolingDown: secondsLeft > 0, label, start, startFromError };
}
