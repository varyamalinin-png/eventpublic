import { useState, useCallback, useMemo } from 'react';
import type { Event } from '../../types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('useSavedEvents');

export interface UseSavedEventsParams {
  events: Event[];
}

export interface UseSavedEventsReturn {
  savedEvents: string[];
  setSavedEvents: React.Dispatch<React.SetStateAction<string[]>>;
  saveEvent: (eventId: string) => void;
  removeSavedEvent: (eventId: string) => void;
  isEventSaved: (eventId: string) => boolean;
  getSavedEvents: () => Event[];
}

export const useSavedEvents = ({
  events,
}: UseSavedEventsParams): UseSavedEventsReturn => {
  const [savedEvents, setSavedEvents] = useState<string[]>([]);

  // Сохранение события
  const saveEvent = useCallback((eventId: string) => {
    setSavedEvents(prev => {
      if (prev.includes(eventId)) {
        return prev;
      }
      logger.debug('Событие сохранено:', eventId);
      return [...prev, eventId];
    });
  }, []);

  // Удаление сохраненного события
  const removeSavedEvent = useCallback((eventId: string) => {
    setSavedEvents(prev => {
      const filtered = prev.filter(id => id !== eventId);
      if (filtered.length !== prev.length) {
        logger.debug('Событие удалено из сохраненных:', eventId);
      }
      return filtered;
    });
  }, []);

  // Проверка, сохранено ли событие
  const isEventSaved = useCallback((eventId: string): boolean => {
    return savedEvents.includes(eventId);
  }, [savedEvents]);

  // Получить список сохраненных событий
  const getSavedEvents = useCallback((): Event[] => {
    return events.filter(event => savedEvents.includes(event.id));
  }, [events, savedEvents]);

  return {
    savedEvents,
    setSavedEvents,
    saveEvent,
    removeSavedEvent,
    isEventSaved,
    getSavedEvents,
  };
};

