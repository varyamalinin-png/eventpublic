/**
 * Утилиты для работы с Yandex MapKit SDK
 * 
 * Текущая реализация использует WebView с JavaScript API,
 * но этот модуль готов для будущей интеграции нативного MapKit SDK
 * 
 * Документация: https://yandex.ru/dev/maps/mapkitjs/
 */

export const MAPKIT_API_KEY = '0b6f9cca-f83d-4b26-a837-7f0affdf242f';

/**
 * Инициализация MapKit для нативного использования
 * В будущем может быть использовано для интеграции react-native-yandex-mapkit
 */
export function initMapKit() {
  // Здесь будет инициализация нативного MapKit SDK
  // Для текущей реализации не требуется
  console.log('MapKit SDK key:', MAPKIT_API_KEY);
}

/**
 * Проверка доступности MapKit API
 */
export function isMapKitAvailable(): boolean {
  // В текущей реализации возвращаем false,
  // так как используем WebView
  return false;
}

/**
 * Получить ключ API для MapKit
 */
export function getMapKitApiKey(): string {
  return MAPKIT_API_KEY;
}

 * Утилиты для работы с Yandex MapKit SDK
 * 
 * Текущая реализация использует WebView с JavaScript API,
 * но этот модуль готов для будущей интеграции нативного MapKit SDK
 * 
 * Документация: https://yandex.ru/dev/maps/mapkitjs/
 */

export const MAPKIT_API_KEY = '0b6f9cca-f83d-4b26-a837-7f0affdf242f';

/**
 * Инициализация MapKit для нативного использования
 * В будущем может быть использовано для интеграции react-native-yandex-mapkit
 */
export function initMapKit() {
  // Здесь будет инициализация нативного MapKit SDK
  // Для текущей реализации не требуется
  console.log('MapKit SDK key:', MAPKIT_API_KEY);
}

/**
 * Проверка доступности MapKit API
 */
export function isMapKitAvailable(): boolean {
  // В текущей реализации возвращаем false,
  // так как используем WebView
  return false;
}

/**
 * Получить ключ API для MapKit
 */
export function getMapKitApiKey(): string {
  return MAPKIT_API_KEY;
}

