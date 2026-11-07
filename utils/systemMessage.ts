/**
 * Локализация системных сообщений чата.
 *
 * Текст таких сообщений создаёт СЕРВЕР и хранит его в базе, поэтому готовая
 * фраза на одном языке навсегда осталась бы такой в истории. Сервер теперь
 * пишет языконезависимый маркер `[[sys:<событие>]]<данные>`, а формулировку
 * подставляет клиент из своей локали.
 *
 * Старый формат (готовая русская фраза) тоже распознаётся: сообщения,
 * созданные до этой правки, уже лежат в базе и переписать их нельзя.
 */
type Translations = { chat: { userLeftChat: string } };

const MARKER_RE = /^\[\[sys:(\w+)\]\]([\s\S]*)$/;
/** Прежний формат — оставлен ради уже созданных записей. */
const LEGACY_LEFT_CHAT_RE = /^(.+?)\s+покинул\(?а?\)?\s+чат$/i;

export function localizeSystemMessage(
  content: string | undefined | null,
  t: Translations,
): string {
  const text = String(content ?? '');

  const marker = text.match(MARKER_RE);
  if (marker) {
    const [, kind, payload] = marker;
    switch (kind) {
      case 'left_chat':
        return t.chat.userLeftChat.replace('{name}', payload.trim());
      default:
        // Неизвестный маркер от более новой версии сервера: показываем
        // полезную часть, а не сырую служебную строку.
        return payload.trim();
    }
  }

  const legacy = text.match(LEGACY_LEFT_CHAT_RE);
  if (legacy) {
    return t.chat.userLeftChat.replace('{name}', legacy[1].trim());
  }

  return text;
}
