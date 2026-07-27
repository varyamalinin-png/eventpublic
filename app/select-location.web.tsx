import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { createLogger } from '../utils/logger';
import { AppIcon } from '../components/ui/AppIcon';
import { Palette } from '../constants/DesignSystem';
import Constants from 'expo-constants';

const logger = createLogger('SelectLocation');

// Глобальное хранилище для выбранного места (то же самое, что в select-location.tsx)
// Используем общий объект через window для веба
const getGlobalStorage = () => {
  if (typeof window !== 'undefined' && (window as any).__selectedLocationStorage) {
    return (window as any).__selectedLocationStorage;
  }
  if (typeof window !== 'undefined') {
    (window as any).__selectedLocationStorage = { location: null };
    return (window as any).__selectedLocationStorage;
  }
  return { location: null };
};

// Функция для получения выбранного места
export function getSelectedLocation() {
  return getGlobalStorage().location;
}

// Функция для очистки выбранного места
export function clearSelectedLocation() {
  getGlobalStorage().location = null;
}

function setGlobalSelectedLocation(location: { latitude: number; longitude: number; address: string } | null) {
  getGlobalStorage().location = location;
}

declare global {
  interface Window {
    ymaps: any;
  }
}

export default function SelectLocationScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const placemarkRef = useRef<any>(null);
  const searchControlRef = useRef<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Создаем div для карты при монтировании
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && mapContainerRef.current && !mapRef.current) {
      const mapDiv = document.createElement('div');
      mapDiv.id = 'select-location-map';
      mapDiv.style.width = '100%';
      mapDiv.style.height = '100%';
      mapDiv.style.minHeight = '400px';
      mapContainerRef.current.appendChild(mapDiv);
      mapRef.current = mapDiv;
      
      return () => {
        if (mapRef.current && mapContainerRef.current) {
          mapContainerRef.current.removeChild(mapRef.current);
          mapRef.current = null;
        }
      };
    }
  }, []);

  // Загружаем Яндекс.Карты
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mapsApiKey = process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY || 
                       Constants.expoConfig?.extra?.YANDEX_MAPS_API_KEY || 
                       'e95f18c1-e796-4e6a-b2a9-0aafe5e420c4';

    // Проверяем, не загружены ли уже карты
    if (window.ymaps) {
      setMapsLoaded(true);
      // Инициализацию карты делаем в отдельном useEffect
      return;
    }

    // Загружаем скрипт Яндекс.Карт
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${mapsApiKey}&lang=ru_RU`;
    script.async = true;
    script.onload = () => {
      setMapsLoaded(true);
      window.ymaps.ready(() => {
        initializeMap();
      });
    };
    document.head.appendChild(script);

    return () => {
      // Очищаем карту при размонтировании
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy();
      }
    };
  }, []);

  const selectLocation = useCallback((coords: number[], map: any) => {
    if (!window.ymaps) return;

    // Удаляем предыдущий маркер
    if (placemarkRef.current) {
      map.geoObjects.remove(placemarkRef.current);
    }

    // Создаем новый маркер
    const placemark = new window.ymaps.Placemark(coords, {
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

    map.geoObjects.add(placemark);
    placemarkRef.current = placemark;

    // Геокодирование для получения адреса
    window.ymaps.geocode(coords, { kind: 'house' }).then((res: any) => {
      const firstGeoObject = res.geoObjects.get(0);
      const address = firstGeoObject 
        ? firstGeoObject.getAddressLine() 
        : coords[0].toPrecision(6) + ', ' + coords[1].toPrecision(6);
      
      setSelectedLocation({
        latitude: coords[0],
        longitude: coords[1],
        address: address,
      });
    }).catch((error: any) => {
      logger.error('Error geocoding:', error);
      // Если геокодирование не удалось, используем координаты
      setSelectedLocation({
        latitude: coords[0],
        longitude: coords[1],
        address: coords[0].toPrecision(6) + ', ' + coords[1].toPrecision(6),
      });
    });
  }, []);

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.ymaps) {
      logger.warn('Map not ready:', { hasRef: !!mapRef.current, hasYmaps: !!window.ymaps });
      return;
    }

    // Проверяем, что карта еще не создана
    if (mapInstanceRef.current) {
      logger.warn('Map already initialized');
      return;
    }

    try {
      // Убеждаемся, что контейнер имеет размеры
      const container = mapRef.current;
      if (!container.offsetHeight || !container.offsetWidth) {
        logger.warn('Container has no size, retrying...');
        setTimeout(() => initializeMap(), 200);
        return;
      }

      // Создаем карту
      const map = new window.ymaps.Map(container, {
        center: [55.7558, 37.6176], // Москва
        zoom: 10,
      });

      mapInstanceRef.current = map;

      // Добавляем поиск
      const searchControl = new window.ymaps.control.SearchControl({
        options: {
          provider: 'yandex#search',
          placeholderContent: t.map.searchAddress,
          noPlacemark: false,
        },
      });

      map.controls.add(searchControl);
      searchControlRef.current = searchControl;

      // Обработчик клика по карте
      map.events.add('click', (e: any) => {
        const coords = e.get('coords');
        selectLocation(coords, map);
      });

      // Обработчик выбора результата поиска
      searchControl.events.add('resultselect', (e: any) => {
        const index = e.get('index');
        searchControl.getResult(index).then((res: any) => {
          const coords = res.geometry.getCoordinates();
          selectLocation(coords, map);
          map.setCenter(coords);
        });
      });

      // Обработчик поиска по запросу
      searchControl.events.add('submit', () => {
        searchControl.getResult(0).then((res: any) => {
          if (res) {
            const coords = res.geometry.getCoordinates();
            selectLocation(coords, map);
            map.setCenter(coords);
          }
        });
      });

      logger.debug('Map initialized successfully');
    } catch (error) {
      logger.error('Error initializing map:', error);
    }
  }, [selectLocation]);

  // Инициализируем карту после загрузки
  useEffect(() => {
    if (mapsLoaded && mapRef.current && !mapInstanceRef.current) {
      // Небольшая задержка для гарантии, что контейнер получил размеры
      const timer = setTimeout(() => {
        initializeMap();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mapsLoaded, initializeMap]);

  // Обновляем размеры карты при изменении размера окна
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.container.fitToViewport();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mapInstanceRef.current]);

  const handleConfirm = () => {
    if (!selectedLocation) {
      if (typeof window !== 'undefined') {
        window.alert(t.map.pickPlaceOnMap);
      }
      return;
    }

    // Сохраняем выбранное место в глобальное хранилище
    const storage = getGlobalStorage();
    storage.location = selectedLocation;
    
    // Также сохраняем в sessionStorage для надежности при перезагрузке страницы
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('selectedLocation', JSON.stringify(selectedLocation));
      } catch (error) {
        logger.warn('Failed to save location to sessionStorage:', error);
      }
    }
    
    router.back();
  };

  const handleSearch = useCallback(() => {
    if (!searchControlRef.current || !searchQuery.trim()) return;
    
    searchControlRef.current.search(searchQuery);
  }, [searchQuery]);

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
        <input
          type="text"
          placeholder={t.map.searchAddress}
          value={searchQuery}
          onChange={(e: any) => setSearchQuery(e.target.value)}
          onKeyPress={(e: any) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
          style={styles.searchInput as any}
        />
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={handleSearch}
        >
          <AppIcon name="search" size={18} color={Palette.text} />
        </TouchableOpacity>
      </View>

      {/* Карта */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' && typeof window !== 'undefined' ? (
          <div 
            ref={mapContainerRef}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '400px',
              position: 'relative',
            }}
          />
        ) : null}
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
    display: 'flex' as any,
    flexDirection: 'column' as any,
    height: Platform.OS === 'web' ? '100vh' : undefined,
    minHeight: Platform.OS === 'web' ? '100vh' : undefined,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 20 : 60,
    paddingBottom: 20,
    backgroundColor: '#0a0a0c',
  },
  backButton: {
    marginRight: 15,
    cursor: 'pointer',
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
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#0a0a0c',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#141417',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#f4f4f5',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderStyle: 'solid',
  },
  searchButton: {
    width: 50,
    height: 50,
    backgroundColor: '#FF8D32',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  searchButtonText: {
    color: '#f4f4f5',
    fontSize: 20,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    minHeight: Platform.OS === 'web' ? '400px' : undefined,
    position: 'relative' as any,
  },
  mapDiv: {
    width: '100%',
    height: '100%',
    minHeight: Platform.OS === 'web' ? '400px' : undefined,
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  selectedLocationContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#141417',
    borderTopWidth: 1,
    borderTopColor: '#333',
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
    borderTopColor: '#333',
  },
  confirmButton: {
    backgroundColor: '#FF8D32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    cursor: 'pointer',
  },
  confirmButtonDisabled: {
    backgroundColor: '#333',
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  confirmButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
  },
});

