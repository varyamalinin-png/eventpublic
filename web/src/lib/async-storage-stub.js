// web/src/lib/async-storage-stub.js
// Заглушка для @react-native-async-storage/async-storage

const storage = {};

export default {
  getItem: async (key) => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('[AsyncStorage] getItem error:', e);
      return null;
    }
  },
  setItem: async (key, value) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('[AsyncStorage] setItem error:', e);
    }
  },
  removeItem: async (key) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[AsyncStorage] removeItem error:', e);
    }
  },
  clear: async () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('[AsyncStorage] clear error:', e);
    }
  },
  getAllKeys: async () => {
    if (typeof window === 'undefined') return [];
    try {
      return Object.keys(localStorage);
    } catch (e) {
      console.warn('[AsyncStorage] getAllKeys error:', e);
      return [];
    }
  },
  multiGet: async (keys) => {
    if (typeof window === 'undefined') return [];
    try {
      return keys.map(key => [key, localStorage.getItem(key)]);
    } catch (e) {
      console.warn('[AsyncStorage] multiGet error:', e);
      return [];
    }
  },
  multiSet: async (pairs) => {
    if (typeof window === 'undefined') return;
    try {
      pairs.forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    } catch (e) {
      console.warn('[AsyncStorage] multiSet error:', e);
    }
  },
  multiRemove: async (keys) => {
    if (typeof window === 'undefined') return;
    try {
      keys.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('[AsyncStorage] multiRemove error:', e);
    }
  },
};

