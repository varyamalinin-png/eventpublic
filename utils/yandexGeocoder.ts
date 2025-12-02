/**
 * Функция для автодополнения адресов через Яндекс Geocoder API
 * Документация: https://yandex.ru/dev/geocode/doc/ru/
 */

import { createLogger } from './logger';

const logger = createLogger('YandexGeocoder');

interface GeocodeResult {
  name: string;
  description: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Получить автодополнение адресов
 * @param query - Текст для поиска
 * @param apiKey - Ключ API Яндекс.Карт
 * @returns Массив результатов с адресами и координатами
 */
export async function suggestAddresses(query: string, apiKey?: string): Promise<GeocodeResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const API_KEY = apiKey || process.env.EXPO_PUBLIC_YANDEX_GEOCODER_API_KEY || 'd84ff24e-0878-41ab-a83b-517487e2903a'; // API GeoSuggest
    
    // Используем GeoSuggest API для автодополнения адресов
    const url = `https://suggest-maps.yandex.ru/v1/suggest?apikey=${API_KEY}&text=${encodeURIComponent(query)}&type=geo&lang=ru_RU&results=5`;

    logger.debug('Запрос к GeoSuggest API:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Ошибка ответа API:', response.status, response.statusText, errorText);
      return [];
    }
    
    const text = await response.text();
    
    if (!text || text.trim().length === 0) {
      logger.error('Пустой ответ от API');
      return [];
    }
    
    logger.debug('Ответ API:', text.substring(0, 200));
    
    const data = JSON.parse(text);

    // GeoSuggest API возвращает результаты в формате {results: [...]}
    if (!data.results || !Array.isArray(data.results)) {
      logger.debug('Нет results в ответе:', data);
      return [];
    }

    return data.results.map((result: {
      title?: { text?: string };
      subtitle?: { text?: string };
      geo_context?: { geometry?: { coordinates?: number[] } };
      [key: string]: unknown;
    }) => {
      // Формат результата GeoSuggest
      const title = result.title?.text || '';
      const description = result.subtitle?.text || title;
      const coords = result.geo_context?.geometry?.coordinates || [37.6176, 55.7558];
      
      return {
        name: title,
        description: description,
          coordinates: {
          latitude: coords[1], // latitude - второй элемент
          longitude: coords[0], // longitude - первый элемент
        },
      };
    });
  } catch (error) {
    logger.error('Ошибка автодополнения адресов:', error);
    return [];
  }
}

/**
 * Геокодирование адреса в координаты
 * @param address - Адрес для геокодирования
 * @param apiKey - Ключ API Яндекс.Карт
 * @returns Координаты или null
 */
export async function geocodeAddress(
  address: string,
  apiKey?: string
): Promise<{ latitude: number; longitude: number } | null> {
  if (!address) {
    return null;
  }

  try {
    const API_KEY = apiKey || 'd84ff24e-0878-41ab-a83b-517487e2903a'; // GeoSuggest
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${API_KEY}&geocode=${encodeURIComponent(address)}&format=json&lang=ru_RU&results=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.response?.GeoObjectCollection?.featureMember?.[0]) {
      return null;
    }

    const geoObject = data.response.GeoObjectCollection.featureMember[0].GeoObject;
    const coordinates = geoObject.Point.pos.split(' ').map(parseFloat);

    return {
      longitude: coordinates[0],
      latitude: coordinates[1],
    };
  } catch (error) {
    logger.error('Ошибка геокодирования:', error);
    return null;
  }
}

/**
 * Обратное геокодирование: координаты в адрес
 * @param latitude - Широта
 * @param longitude - Долгота
 * @param apiKey - Ключ API Яндекс.Карт
 * @returns Адрес или null
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  apiKey?: string
): Promise<string | null> {
  try {
    const API_KEY = apiKey || 'd84ff24e-0878-41ab-a83b-517487e2903a'; // GeoSuggest
    const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${API_KEY}&geocode=${longitude},${latitude}&format=json&lang=ru_RU&kind=house&results=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.response?.GeoObjectCollection?.featureMember?.[0]) {
      return null;
    }

    const geoObject = data.response.GeoObjectCollection.featureMember[0].GeoObject;
    return geoObject.name;
  } catch (error) {
    logger.error('Ошибка обратного геокодирования:', error);
    return null;
  }
}
