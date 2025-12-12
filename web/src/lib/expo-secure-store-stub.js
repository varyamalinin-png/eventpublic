// Заглушка для expo-secure-store (использует localStorage)
export const getItemAsync = async (key) => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(key);
  }
  return null;
};

export const setItemAsync = async (key, value) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, value);
  }
};

export const deleteItemAsync = async (key) => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(key);
  }
};

export const isAvailableAsync = async () => {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
};

export default {
  getItemAsync,
  setItemAsync,
  deleteItemAsync,
  isAvailableAsync,
};

