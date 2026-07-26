import { useState, useCallback } from 'react';
import { useEvents } from '../context/EventsContext';

export function useRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const { syncEventsFromServer, syncChatsFromServer, refreshNotifications } = useEvents();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        syncEventsFromServer(),
        syncChatsFromServer(),
        refreshNotifications(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [syncEventsFromServer, syncChatsFromServer, refreshNotifications]);

  return { refreshing, onRefresh };
}
