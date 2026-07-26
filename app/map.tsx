// Базовый файл для Expo Router
// Для веба используем map.web.tsx, для нативных платформ - map.native.tsx
// Expo Router автоматически выберет правильную версию через платформенные расширения

// Реэкспортируем нативную версию (для iOS/Android)
// Для веба Expo Router автоматически выберет map.web.tsx
export { default } from './map.native';
