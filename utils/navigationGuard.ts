import { router } from 'expo-router';
import { createLogger } from './logger';

const logger = createLogger('NavGuard');

/**
 * Защита от повторного открытия одного и того же экрана.
 *
 * Быстрые повторные нажатия (двойной тап по карточке, «залипшая» кнопка)
 * клали в стек несколько КОПИЙ одного экрана: страница открывалась по
 * нескольку раз, а каждая копия оставалась смонтированной со своими
 * подписками и запросами — отсюда же нарастающие подвисания и дёрганые
 * свайпы после долгого хождения по приложению.
 *
 * Патчим единственный объект router из expo-router: useRouter() возвращает
 * ИМЕННО ЕГО (см. expo-router/build/hooks.js → return imperative_api.router),
 * поэтому одна обёртка покрывает все места сразу — иначе пришлось бы
 * править каждый вызов в четырёх десятках файлов.
 *
 * Ключ — сам адрес: подряд идущие переходы на РАЗНЫЕ экраны не блокируются,
 * гасится только повтор того же адреса внутри короткого окна.
 */
const REPEAT_WINDOW_MS = 700;

const hrefKey = (href: unknown): string => {
  if (typeof href === 'string') return href;
  try {
    return JSON.stringify(href);
  } catch {
    return String(href);
  }
};

let lastKey: string | null = null;
let lastAt = 0;
let installed = false;

export function installNavigationGuard() {
  if (installed) return;
  installed = true;

  (['push', 'navigate', 'replace'] as const).forEach((method) => {
    const original = (router as any)[method];
    if (typeof original !== 'function') return;

    (router as any)[method] = (...args: any[]) => {
      const key = `${method}:${hrefKey(args[0])}`;
      const now = Date.now();
      if (key === lastKey && now - lastAt < REPEAT_WINDOW_MS) {
        logger.debug('Повторный переход подавлен:', key);
        return;
      }
      lastKey = key;
      lastAt = now;
      return original(...args);
    };
  });
}
