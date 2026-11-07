import { USER_NAME_FALLBACK } from '../context/EventsContext.helpers';

type MinimalChat = {
  type?: string;
  name?: string;
  participants?: string[];
};

type UserLike = { name?: string; username?: string; [key: string]: unknown } | null | undefined;

/**
 * Имя личного чата = имя собеседника, вычисленное НА РЕНДЕРЕ.
 *
 * Раньше имя один раз «замораживалось» в chat.name при синхронизации, причём
 * сразу после applyServerUserDataToState — то есть до того, как setState
 * успевал применить профили участников. Собеседник был ещё неизвестен,
 * getUserData отдавал служебный USER_NAME_FALLBACK, и в списке чатов
 * оставалось «Пользователь» вплоть до следующей синхронизации.
 * Живой расчёт чинится сам, как только профиль долетает.
 */
export function getChatDisplayName(
  chat: MinimalChat,
  currentUserId: string | null | undefined,
  getUserData: (userId: string) => UserLike,
  fallback: string,
): string {
  const frozen = chat.name && chat.name !== USER_NAME_FALLBACK ? chat.name : '';

  if (chat.type !== 'personal') {
    return frozen || fallback;
  }

  const otherUserId = (chat.participants ?? []).find(p => p !== currentUserId);
  if (otherUserId) {
    const other = getUserData(otherUserId);
    const resolved = other?.name && other.name !== USER_NAME_FALLBACK ? other.name : other?.username;
    if (resolved) return resolved;
  }

  return frozen || fallback;
}
