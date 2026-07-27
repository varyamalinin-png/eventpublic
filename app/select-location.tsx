import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { createLogger } from '../utils/logger';
import { AppIcon } from '../components/ui/AppIcon';
import { Palette } from '../constants/DesignSystem';

const logger = createLogger('SelectLocation');

// Глобальное хранилище для выбранного места
// На вебе используем window для синхронизации с веб-версией
const getGlobalStorage = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (!(window as any).__selectedLocationStorage) {
      (window as any).__selectedLocationStorage = { location: null };
    }
    return (window as any).__selectedLocationStorage;
  }
  // Для мобильных используем локальную переменную
  if (!(global as any).__selectedLocationStorage) {
    (global as any).__selectedLocationStorage = { location: null };
  }
  return (global as any).__selectedLocationStorage;
};

// Функция для получения выбранного места
export function getSelectedLocation() {
  return getGlobalStorage().location;
}

// Функция для очистки выбранного места
export function clearSelectedLocation() {
  getGlobalStorage().location = null;
}

// На вебе используем веб-версию через экспорт Platform.OS
export default function SelectLocationScreen() {
  if (Platform.OS === 'web') {
    // Динамически импортируем веб-версию
    const WebSelectLocationScreen = require('./select-location.web').default;
    return <WebSelectLocationScreen />;
  }
  const router = useRouter();
  const { t } = useLanguage();
  const webViewRef = useRef<WebView>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapHtml, setMapHtml] = useState('');

  useEffect(() => {
    generateMapHtml();
  }, []);

  const generateMapHtml = () => {
    const mapsApiKey = process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY || 'e95f18c1-e796-4e6a-b2a9-0aafe5e420c4';
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
              center: [55.7558, 37.6176],
              zoom: 10
            });

            var placemark;

            myMap.events.add('click', function (e) {
              var coords = e.get('coords');
              
              if (placemark) {
                myMap.geoObjects.remove(placemark);
              }

              placemark = new ymaps.Placemark(coords, {
                balloonContentBody: [
                  '<address>',
                  '<strong>' + t.map.selectedPlace + '</strong><br/>',
                  t.map.coordinates + coords[0].toPrecision(6) + ', ' + coords[1].toPrecision(6),
                  '</address>'
                ].join('')
              }, {
                preset: 'islands#circleDotIcon',
                iconColor: '#FF8D32'
              });

              myMap.geoObjects.add(placemark);

              // Отправляем координаты в React Native
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'locationSelected',
                  coordinates: {
                    latitude: coords[0],
                    longitude: coords[1]
                  }
                }));
              }

              // Геокодирование для получения адреса
              ymaps.geocode(coords, { kind: 'house' }).then(function (res) {
                var firstGeoObject = res.geoObjects.get(0);
                var address = firstGeoObject ? firstGeoObject.getAddressLine() : coords[0].toPrecision(6) + ', ' + coords[1].toPrecision(6);
                
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'addressReceived',
                    address: address,
                    coordinates: {
                      latitude: coords[0],
                      longitude: coords[1]
                    }
                  }));
                }
              });
            });

            // Поиск мест
            myMap.events.add('resultselect', function (e) {
              var index = e.get('index');
              mySearchControl.getResult(index).then(function (res) {
                var coords = res.geometry.getCoordinates();
                
                if (placemark) {
                  myMap.geoObjects.remove(placemark);
                }

                placemark = new ymaps.Placemark(coords, {
                  balloonContentBody: res.properties.get('description') || res.properties.get('name')
                });

                myMap.geoObjects.add(placemark);
                myMap.setCenter(coords);
              });
            });
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
      
      if (data.type === 'addressReceived') {
        setSelectedLocation({
          latitude: data.coordinates.latitude,
          longitude: data.coordinates.longitude,
          address: data.address
        });
      } else if (data.type === 'locationSelected') {
        setSelectedLocation({
          latitude: data.coordinates.latitude,
          longitude: data.coordinates.longitude,
          address: data.address || `${data.coordinates.latitude.toFixed(4)}, ${data.coordinates.longitude.toFixed(4)}`
        });
      }
    } catch (error) {
      logger.error('Error parsing WebView message:', error);
    }
  };

  const handleConfirm = () => {
    if (!selectedLocation) {
      Alert.alert(t.common.error, 'Пожалуйста, выберите место на карте');
      return;
    }

    // Сохраняем выбранное место в глобальное хранилище
    getGlobalStorage().location = selectedLocation;
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Заголовок */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← {t.common.back}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.map.selectOnMap}</Text>
      </View>

      {/* Поиск */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t.map.searchAddress}
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Карта */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={styles.mapWebView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onMessage={handleWebViewMessage}
        />
      </View>

      {/* Выбранное место */}
      {selectedLocation && (
        <View style={styles.selectedLocationContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <AppIcon name="pin" size={13} color={Palette.textDim} />
            <Text style={[styles.selectedLocationText, { flex: 1 }]}>
              {selectedLocation.address}
            </Text>
          </View>
        </View>
      )}

      {/* Кнопка подтверждения */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.confirmButton, !selectedLocation && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!selectedLocation}
        >
          <Text style={styles.confirmButtonText}>{t.map.confirmPlace}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#0a0a0c',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: '#FF8D32',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#f4f4f5',
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#0a0a0c',
  },
  searchInput: {
    height: 50,
    backgroundColor: '#141417',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#f4f4f5',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  mapWebView: {
    flex: 1,
  },
  selectedLocationContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#141417',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  selectedLocationText: {
    color: '#FF8D32',
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#0a0a0c',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  confirmButton: {
    backgroundColor: '#FF8D32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
  },
});
