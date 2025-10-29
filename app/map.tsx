import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ScrollView, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEvents } from '../context/EventsContext';
import * as Location from 'expo-location';

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const router = useRouter();
  const { events } = useEvents();
  const { eventId, selectLocation, userId } = useLocalSearchParams();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [mapHtml, setMapHtml] = useState<string>('');

  // Получаем события для отображения
  // Фильтруем события: показываем только те, где пользователь участник или организатор
  const eventsToShow = eventId 
    ? events.filter(event => event.id === eventId)
    : events.filter(event => {
        if (!event.coordinates) return false;
        
        // Если указан userId - фильтруем для другого пользователя
        if (userId && userId !== 'own-profile-1') {
          // Для другого пользователя показываем только события, где он организатор
          return event.organizerId === userId;
        }
        
        // Для текущего пользователя: проверяем участник или организатор
        const isParticipant = event.participantsList?.includes('https://randomuser.me/api/portraits/women/68.jpg');
        const isOrganizer = event.organizerId === 'own-profile-1';
        return isParticipant || isOrganizer;
      });

  useEffect(() => {
    getCurrentLocation();
    generateMapHtml();
  }, [eventsToShow, location]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Ошибка', 'Разрешение на доступ к местоположению не предоставлено');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    } catch (error) {
      console.error('Ошибка получения местоположения:', error);
    }
  };

  const generateMapHtml = () => {
    if (eventsToShow.length === 0) {
      setMapHtml(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 20px; background: #1a1a1a; color: white; font-family: Arial; text-align: center; }
            .no-events { margin-top: 50px; }
          </style>
        </head>
        <body>
          <div class="no-events">
            <h2>🗺️</h2>
            <h3>События не найдены</h3>
            <p>Нет событий с координатами для отображения на карте</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Используем Яндекс.Карты для отображения
    const centerLat = eventsToShow[0]?.coordinates?.latitude || 55.7558;
    const centerLng = eventsToShow[0]?.coordinates?.longitude || 37.6176;
    
    console.log('Map HTML Generation:', {
      eventId,
      eventsCount: eventsToShow.length,
      firstEventId: eventsToShow[0]?.id,
      firstEventTitle: eventsToShow[0]?.title,
      firstEventLocation: eventsToShow[0]?.location,
      coordinates: eventsToShow[0]?.coordinates,
      centerLat,
      centerLng
    });
    
    // Определяем zoom в зависимости от количества событий
    const zoom = eventId ? 15 : 10;
    
    const markers = eventsToShow.map((event, index) => {
      const lat = event.coordinates?.latitude || 55.7558;
      const lng = event.coordinates?.longitude || 37.6176;
      return `new ymaps.Placemark([${lat}, ${lng}], {
        balloonContentHeader: ${JSON.stringify(event.title)},
        balloonContentBody: ${JSON.stringify(event.location)}
      })`;
    }).join(',\n      ');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://api-maps.yandex.ru/2.1/?apikey=e95f18c1-e796-4e6a-b2a9-0aafe5e420c4&lang=ru_RU" type="text/javascript"></script>
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
              center: [${centerLat}, ${centerLng}],
              zoom: ${zoom}
            });

            ${eventsToShow.map((event, index) => {
              const lat = event.coordinates?.latitude || 55.7558;
              const lng = event.coordinates?.longitude || 37.6176;
              return `
              var marker${index} = new ymaps.Placemark([${lat}, ${lng}], {
                balloonContentHeader: ${JSON.stringify(event.title)},
                balloonContentBody: ${JSON.stringify(`${event.location}<br>${event.date} в ${event.time}`)}
                }, {
                  preset: 'islands#circleDotIcon',
                  iconColor: '#8B5CF6'
                });
              myMap.geoObjects.add(marker${index});`;
            }).join('\n            ')}

            // Открытие Яндекс.Карт при клике на маркер
            myMap.geoObjects.events.add('click', function (e) {
              var target = e.get('target');
              var coords = target.geometry.getCoordinates();
              var yandexMapsUrl = 'yandexmaps://maps.yandex.ru/?pt=' + coords[1] + ',' + coords[0] + '&z=16';
              window.ReactNativeWebView?.postMessage(JSON.stringify({
                type: 'openYandexMaps',
                url: yandexMapsUrl
              }));
            });
          });
        </script>
      </body>
      </html>
    `;
    
    setMapHtml(html);
  };

  const openInYandexMaps = (latitude: number, longitude: number, locationName: string) => {
    const yandexMapsUrl = `yandexmaps://maps.yandex.ru/?pt=${longitude},${latitude}&z=16&l=map`;
    const fallbackUrl = `https://yandex.ru/maps/?pt=${longitude},${latitude}&z=16&l=map`;
    
    Linking.canOpenURL(yandexMapsUrl).then(supported => {
      if (supported) {
        Linking.openURL(yandexMapsUrl);
      } else {
        Linking.openURL(fallbackUrl);
      }
    }).catch(err => {
      console.error('Ошибка открытия Яндекс Карт:', err);
      Alert.alert('Ошибка', 'Не удалось открыть Яндекс Карты');
    });
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'openYandexMaps') {
        Linking.openURL(data.url).catch(err => {
          console.error('Ошибка открытия Яндекс.Карт:', err);
          const fallbackUrl = data.url.replace('yandexmaps://', 'https://yandex.ru/maps/');
          Linking.openURL(fallbackUrl);
        });
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Заголовок */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {selectLocation ? 'Выберите место' : eventId ? 'Место события' : 'Карта событий'}
        </Text>
      </View>

      {/* Карта на весь экран */}
      <View style={styles.mapContainer}>
        <WebView
          source={{ html: mapHtml }}
          style={styles.mapWebView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
          }}
          onMessage={handleWebViewMessage}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#000',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  mapContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  mapWebView: {
    flex: 1,
  },
  eventsList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  eventItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  eventItemContent: {
    padding: 15,
  },
  eventItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventItemTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  eventItemPrice: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
  },
  eventItemDescription: {
    color: '#CCCCCC',
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 20,
  },
  eventItemDetails: {
    marginBottom: 12,
  },
  eventItemLocation: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  eventItemTime: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  eventItemCoordinates: {
    color: '#666',
    fontSize: 10,
  },
  eventItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventItemParticipants: {
    color: '#999',
    fontSize: 12,
  },
  routeButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  routeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});