import { useState, useCallback, useEffect, useRef } from 'react';
import type { Event } from '../../types';
import { createLogger } from '../../utils/logger';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const logger = createLogger('useSavedEvents');

const STORAGE_KEY = 'iwent_saved_event_ids';
const STORAGE_OBJECTS_KEY = 'iwent_saved_event_objects';

function readStorage<T>(key: string): T | null {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }
  } catch {
    // ignore
  }
  return null;
}

function writeStorage(key: string, value: unknown): void {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
    }
  } catch {
    // ignore
  }
}

async function readStorageAsync<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export interface UseSavedEventsParams {
  events: Event[];
}

export interface UseSavedEventsReturn {
  savedEvents: string[];
  setSavedEvents: React.Dispatch<React.SetStateAction<string[]>>;
  saveEvent: (eventId: string, eventObject?: Event) => void;
  removeSavedEvent: (eventId: string) => void;
  isEventSaved: (eventId: string) => boolean;
  getSavedEvents: () => Event[];
  clearAllSavedEvents: () => void;
}

export const useSavedEvents = ({
  events,
}: UseSavedEventsParams): UseSavedEventsReturn => {
  const [savedEvents, setSavedEvents] = useState<string[]>(() => {
    return readStorage<string[]>(STORAGE_KEY) ?? [];
  });

  const [savedObjects, setSavedObjects] = useState<Record<string, Event>>(() => {
    return readStorage<Record<string, Event>>(STORAGE_OBJECTS_KEY) ?? {};
  });

  // On native, load from AsyncStorage on mount (readStorage only works on web)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      readStorageAsync<string[]>(STORAGE_KEY).then(ids => {
        if (ids && ids.length > 0) setSavedEvents(ids);
      });
      readStorageAsync<Record<string, Event>>(STORAGE_OBJECTS_KEY).then(objs => {
        if (objs && Object.keys(objs).length > 0) setSavedObjects(objs);
      });
    }
  }, []);

  // Persist IDs to localStorage whenever they change
  useEffect(() => {
    writeStorage(STORAGE_KEY, savedEvents);
  }, [savedEvents]);

  // Persist objects to localStorage whenever they change
  useEffect(() => {
    writeStorage(STORAGE_OBJECTS_KEY, savedObjects);
  }, [savedObjects]);

  // When the main events array updates, refresh our cached objects for any
  // saved IDs that exist in it (keeps them up-to-date, e.g. title changes)
  const eventsRef = useRef(events);
  eventsRef.current = events;
  useEffect(() => {
    if (savedEvents.length === 0) return;
    const updates: Record<string, Event> = {};
    let hasUpdate = false;
    for (const id of savedEvents) {
      const fresh = events.find(e => e.id === id);
      if (fresh) {
        updates[id] = fresh;
        hasUpdate = true;
      }
    }
    if (hasUpdate) {
      setSavedObjects(prev => ({ ...prev, ...updates }));
    }
  }, [events, savedEvents]);

  // Сохранение события
  const saveEvent = useCallback((eventId: string, eventObject?: Event) => {
    setSavedEvents(prev => {
      if (prev.includes(eventId)) return prev;
      logger.debug('Событие сохранено:', eventId);
      return [...prev, eventId];
    });

    // Store the full object — either the one passed in, or look it up in events
    const obj = eventObject ?? eventsRef.current.find(e => e.id === eventId);
    if (obj) {
      setSavedObjects(prev => ({ ...prev, [eventId]: obj }));
    }
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
    setSavedObjects(prev => {
      if (!(eventId in prev)) return prev;
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  }, []);

  // Проверка, сохранено ли событие
  const isEventSaved = useCallback((eventId: string): boolean => {
    return savedEvents.includes(eventId);
  }, [savedEvents]);

  // Получить список сохраненных событий
  // Priority: live `events` array > savedObjects cache
  const getSavedEvents = useCallback((): Event[] => {
    return savedEvents
      .map(id => {
        // Prefer the live version if available (most up-to-date)
        const live = events.find(e => e.id === id);
        if (live) return live;
        // Fall back to our cached snapshot
        return savedObjects[id] ?? null;
      })
      .filter((e): e is Event => e !== null);
  }, [events, savedEvents, savedObjects]);

  const clearAllSavedEvents = useCallback(() => {
    setSavedEvents([]);
    setSavedObjects({});
    writeStorage(STORAGE_KEY, []);
    writeStorage(STORAGE_OBJECTS_KEY, {});
  }, []);

  return {
    savedEvents,
    setSavedEvents,
    saveEvent,
    removeSavedEvent,
    isEventSaved,
    getSavedEvents,
    clearAllSavedEvents,
  };
};
