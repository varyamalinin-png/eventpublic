import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/api';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useMemoryVisibility');

/** 'all' — состояние по умолчанию, строки для него на сервере нет. */
export type MemoryVisibility = 'all' | 'friends' | 'only_me';

export interface UseMemoryVisibilityParams {
  accessToken: string | null;
  currentUserId: string | null;
}

export interface UseMemoryVisibilityReturn {
  /** Мои настройки: eventId -> 'friends' | 'only_me'. 'all' здесь не хранится. */
  memoryVisibility: Record<string, Exclude<MemoryVisibility, 'all'>>;
  refreshMemoryVisibility: () => Promise<void>;
  setMemoryVisibility: (eventId: string, visibility: MemoryVisibility) => Promise<void>;
}

/**
 * Личная видимость прошедших событий.
 *
 * Настройка относится к «меморис» одного человека: кто увидит это событие,
 * зайдя в ЕГО профиль. У других участников того же события своя настройка —
 * поэтому событие может быть спрятано у меня и открыто у них.
 *
 * Здесь живут только МОИ настройки: по ним рисуются значки на мини-карточках.
 * Чужой профиль спрашивает у сервера отдельно и получает лишь список того,
 * что ему показывать нельзя (см. UserProfileScreen).
 */
export const useMemoryVisibility = ({
  accessToken,
  currentUserId,
}: UseMemoryVisibilityParams): UseMemoryVisibilityReturn => {
  const [memoryVisibility, setMemoryVisibilityState] = useState<
    Record<string, Exclude<MemoryVisibility, 'all'>>
  >({});

  const tokenRef = useRef<string | null>(accessToken);
  const userIdRef = useRef<string | null>(currentUserId);
  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);
  useEffect(() => {
    userIdRef.current = currentUserId;
  }, [currentUserId]);

  // Смена аккаунта не должна оставлять чужие настройки на экране.
  useEffect(() => {
    setMemoryVisibilityState({});
  }, [currentUserId]);

  const refreshMemoryVisibility = useCallback(async () => {
    const token = tokenRef.current;
    const userId = userIdRef.current;
    if (!token || !userId) return;
    try {
      const response = await apiRequest(`/events/memory-visibility/${userId}`, {}, token);
      const settings = Array.isArray(response?.settings) ? response.settings : [];
      const next: Record<string, Exclude<MemoryVisibility, 'all'>> = {};
      settings.forEach((row: any) => {
        if (row?.eventId && (row.visibility === 'friends' || row.visibility === 'only_me')) {
          next[row.eventId] = row.visibility;
        }
      });
      setMemoryVisibilityState(next);
    } catch (error) {
      logger.warn('Не удалось загрузить видимость прошедших событий', error);
    }
  }, []);

  const setMemoryVisibility = useCallback(
    async (eventId: string, visibility: MemoryVisibility) => {
      const token = tokenRef.current;
      if (!token) return;
      // Показываем сразу, до ответа сервера: значок на карточке меняется
      // мгновенно, а при ошибке состояние вернём.
      const previous = memoryVisibility[eventId];
      setMemoryVisibilityState(prev => {
        const next = { ...prev };
        if (visibility === 'all') delete next[eventId];
        else next[eventId] = visibility;
        return next;
      });
      try {
        await apiRequest(
          `/events/${eventId}/memory-visibility`,
          { method: 'PATCH', body: JSON.stringify({ visibility }) },
          token,
        );
      } catch (error) {
        logger.error('Не удалось сохранить видимость прошедшего события', error);
        setMemoryVisibilityState(prev => {
          const next = { ...prev };
          if (previous) next[eventId] = previous;
          else delete next[eventId];
          return next;
        });
        throw error;
      }
    },
    [memoryVisibility],
  );

  return { memoryVisibility, refreshMemoryVisibility, setMemoryVisibility };
};
