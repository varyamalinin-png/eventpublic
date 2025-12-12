// Глобальная константа __DEV__ для браузера
// Используется React Native/Expo кодом
if (typeof window !== 'undefined' && typeof window.__DEV__ === 'undefined') {
  window.__DEV__ = process.env.NODE_ENV !== 'production';
}

// Экспортируем для webpack ProvidePlugin
module.exports = typeof window !== 'undefined' ? window.__DEV__ : (process.env.NODE_ENV !== 'production');

