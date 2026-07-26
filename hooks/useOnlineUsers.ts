import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

const onlineSet = new Set<string>();
const listeners = new Set<() => void>();

function notify() { listeners.forEach(fn => fn()); }

export function initPresenceListeners() {
  if (Platform.OS === 'web') return;
  try {
    const { getSocket } = require('../services/websocket');
    const socket = getSocket();
    if (!socket) return;
    socket.on('presence:online', (data: { userId: string }) => {
      onlineSet.add(data.userId);
      notify();
    });
    socket.on('presence:offline', (data: { userId: string }) => {
      onlineSet.delete(data.userId);
      notify();
    });
  } catch {}
}

export function useOnlineUsers() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick(t => t + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  return {
    isOnline: (userId: string) => onlineSet.has(userId),
    onlineCount: onlineSet.size,
  };
}
