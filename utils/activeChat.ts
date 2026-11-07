/**
 * Какой чат сейчас открыт на экране.
 *
 * Нужен обработчику пушей: сообщение из чата, который человек прямо сейчас
 * читает, не должно выскакивать баннером поверх той же переписки. Обработчик
 * уведомлений живёт на уровне модуля, вне дерева React, поэтому состояние —
 * простая переменная, а не контекст.
 */
let activeChatId: string | null = null;

export function setActiveChatId(chatId: string | null) {
  activeChatId = chatId;
}

export function getActiveChatId(): string | null {
  return activeChatId;
}
