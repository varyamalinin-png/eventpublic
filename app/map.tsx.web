// Веб-версия карты - использует WebView с Yandex Maps вместо react-native-maps
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';
import Constants from 'expo-constants';

// Импортируем хуки в правильном порядке (сначала базовые контексты, потом EventsContext)
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useEvents } from '../context/EventsContext';

const logger = createLogger('Map');

export default function MapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; exploreTab?: string }>();
  const { events, isEventPast } = useEvents();
  const { user } = useAuth();
  const { t } = useLanguage();
  const webViewRef = useRef<WebView>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapHtml, setMapHtml] = useState('');

  useEffect(() => {
    // Запрашиваем разрешение на геолокацию
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        logger.warn('Failed to get location:', error);
      }
    })();
  }, []);

  useEffect(() => {
    generateMapHtml();
  }, [events, userLocation, params.userId]);

  const generateMapHtml = () => {
    const mapsApiKey = process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY || 
                       Constants.expoConfig?.extra?.YANDEX_MAPS_API_KEY || 
                       'e95f18c1-e796-4e6a-b2a9-0aafe5e420c4';
    
    // Фильтруем события для показа на карте
    // Фильтруем события для показа на карте
    const eventsToShow = events.filter(event => {
      if (params.userId && event.organizerId !== params.userId) return false;
      if (!event.coordinates?.latitude || !event.coordinates?.longitude) return false;
      return true;
    });

    const center = userLocation || { latitude: 55.7558, longitude: 37.6176 };
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://api-maps.yandex.ru/2.1/?apikey=${mapsApiKey}&lang=ru_RU" type="text/javascript"></script>
        <style>
          body, html { margin: 0; padding: 0; height: 100%; background: #121212; }
          #map { width: 100%; height: 100%; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          ymaps.ready(function () {
            var myMap = new ymaps.Map('map', {
              center: [${center.latitude}, ${center.longitude}],
              zoom: 10
            });

            // Добавляем маркеры для событий
            ${eventsToShow.map(event => {
              const lat = event.coordinates?.latitude;
              const lng = event.coordinates?.longitude;
              if (!lat || !lng) return '';
              
              const isPast = isEventPast(event);
              const color = isPast ? '#666' : '#8B5CF6';
              
              const title = (event.title || 'Событие').replace(/'/g, "\\'");
              const location = (event.location || '').replace(/'/g, "\\'");
              return `
                var placemark${event.id.replace(/-/g, '_')} = new ymaps.Placemark([${lat}, ${lng}], {
                  balloonContentBody: '<strong>${title}</strong><br/>${location}',
                  balloonContentFooter: '<a href="#" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type: \\'eventClick\\', eventId: \\'${event.id}\\'})); return false;">Открыть</a>'
                }, {
                  preset: 'islands#circleDotIcon',
                  iconColor: '${color}'
                });
                myMap.geoObjects.add(placemark${event.id.replace(/-/g, '_')});
              `;
            }).join('')}

            // Добавляем маркер текущего местоположения
            ${userLocation ? `
              var userPlacemark = new ymaps.Placemark([${userLocation.latitude}, ${userLocation.longitude}], {
                balloonContentBody: 'Ваше местоположение'
              }, {
                preset: 'islands#blueCircleDotIcon'
              });
              myMap.geoObjects.add(userPlacemark);
            ` : ''}
          });
        </script>
      </body>
      </html>
    `;
    setMapHtml(html);
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'eventClick' && data.eventId) {
        router.push(`/event-profile/${data.eventId}`);
      }
    } catch (error) {
      logger.warn('Failed to parse WebView message:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Карта событий</Text>
      </View>

      <View style={styles.mapContainer}>
        {mapHtml ? (
          <WebView
            ref={webViewRef}
            source={{ html: mapHtml }}
            style={styles.mapWebView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={handleWebViewMessage}
          />
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Загрузка карты...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
  },
  mapWebView: {
    flex: 1,
    backgroundColor: '#121212',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
});

