import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useEvents } from '../../context/EventsContext';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { suggestAddresses, geocodeAddress } from '../../utils/yandexGeocoder';
import { getSelectedLocation, clearSelectedLocation } from '../select-location';

interface EventFormData {
  title: string;
  description: string;
  date: Date;
  time: Date;
  location: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  price: string;
  maxParticipants: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  selectedImage: string | null;
}

export default function CreateEventScreen() {
  const router = useRouter();
  const { addEvent } = useEvents();
  const [currentStep, setCurrentStep] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    date: new Date(),
    time: new Date(),
    location: '',
    price: '',
    maxParticipants: '',
    mediaUrl: '',
    mediaType: 'image',
    selectedImage: null
  });

  // Состояния для автодополнения адресов
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{
    name: string;
    description: string;
    coordinates: { latitude: number; longitude: number };
  }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const steps = [
    { number: 1, title: 'Основная информация' },
    { number: 2, title: 'Медиа' },
    { number: 3, title: 'Просмотр' }
  ];

  // Проверяем выбранное место каждые 500мс
  useEffect(() => {
    const interval = setInterval(() => {
      const selectedLocation = getSelectedLocation();
      if (selectedLocation) {
        console.log('Found selected location:', selectedLocation);
        setFormData(prev => ({
          ...prev,
          location: selectedLocation.address,
          coordinates: {
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude
          }
        }));
        clearSelectedLocation();
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Обработка изменения адреса с автодополнением
  const handleLocationChange = async (value: string) => {
    setFormData(prev => ({ ...prev, location: value }));
    
    if (value.length >= 2) {
      const suggestions = await suggestAddresses(value);
      setAddressSuggestions(suggestions);
      setShowSuggestions(true);
    } else {
      setAddressSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (suggestion: typeof addressSuggestions[0]) => {
    console.log('Selecting suggestion:', {
      description: suggestion.description,
      coordinates: suggestion.coordinates
    });
    
    // Используем координаты из подсказки, они уже есть
    const newCoordinates = {
      latitude: suggestion.coordinates.latitude,
      longitude: suggestion.coordinates.longitude
    };
    
    console.log('Setting coordinates:', newCoordinates);
    
    setFormData(prev => ({
      ...prev,
      location: suggestion.description,
      coordinates: newCoordinates
    }));
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  const handleInputChange = (field: keyof EventFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData(prev => ({ ...prev, date: selectedDate }));
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setFormData(prev => ({ ...prev, time: selectedTime }));
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long'
    });
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ошибка', 'Нет доступа к галерее');
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData(prev => ({ 
        ...prev, 
        selectedImage: result.assets[0].uri,
        mediaUrl: result.assets[0].uri,
        mediaType: 'image'
      }));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ошибка', 'Нет доступа к камере');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData(prev => ({ 
        ...prev, 
        selectedImage: result.assets[0].uri,
        mediaUrl: result.assets[0].uri,
        mediaType: 'image'
      }));
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ 
      ...prev, 
      selectedImage: null,
      mediaUrl: ''
    }));
  };

  const showImageOptions = () => {
    Alert.alert(
      'Выберите изображение',
      'Откуда хотите добавить фото?',
      [
        { text: 'Галерея', onPress: pickImage },
        { text: 'Камера', onPress: takePhoto },
        { text: 'Отмена', style: 'cancel' }
      ]
    );
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleLocationSelect = () => {
    // Переход на карту для выбора места
    router.push('/select-location');
  };


  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.location) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все обязательные поля');
      return;
    }

    // Вычисляем соотношение сторон медиа (примерное)
    const mediaAspectRatio = formData.mediaUrl ? 1.33 : 1;

    console.log('Creating event with data:', {
      location: formData.location,
      coordinates: formData.coordinates
    });

    const newEvent = {
      title: formData.title,
      description: formData.description,
      date: formatDateForAPI(formData.date),
      time: formatTime(formData.time),
      displayDate: formatDisplayDate(formData.date),
      displayTime: formatTime(formData.time),
      location: formData.location,
      coordinates: formData.coordinates ? {
        latitude: formData.coordinates.latitude,
        longitude: formData.coordinates.longitude
      } : undefined,
      price: formData.price || 'Бесплатно',
      participants: 0,
      maxParticipants: parseInt(formData.maxParticipants) || 10,
      organizerAvatar: 'https://randomuser.me/api/portraits/women/68.jpg', // Текущий пользователь
      organizerId: 'own-profile-1',
      mediaUrl: formData.mediaUrl || undefined,
      mediaType: formData.mediaType,
      mediaAspectRatio,
      participantsList: []
    };

    addEvent(newEvent);
    Alert.alert('Успех', 'Событие создано!', [
      { text: 'OK', onPress: () => router.push('/(tabs)/explore') }
    ]);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.label}>Событие *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={(value) => handleInputChange('title', value)}
              placeholder="Например: Прогулка по парку"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Описание</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              placeholder="Расскажите подробнее о событии..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Дата *</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateTimeButtonText}>
                {formatDate(formData.date)}
              </Text>
              <Text style={styles.dateTimeButtonIcon}>📅</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={formData.date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    if (Platform.OS === 'android') {
                      if (selectedDate) {
                        setFormData(prev => ({ ...prev, date: selectedDate }));
                        setShowDatePicker(false);
                      }
                    } else {
                      setFormData(prev => ({ ...prev, date: selectedDate || formData.date }));
                    }
                  }}
                  minimumDate={new Date()}
                  textColor="#FFFFFF"
                  accentColor="#8B5CF6"
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.confirmButtonText}>Выбрать</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text style={styles.label}>Время *</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.dateTimeButtonText}>
                {formatTime(formData.time)}
              </Text>
              <Text style={styles.dateTimeButtonIcon}>🕐</Text>
            </TouchableOpacity>

            {showTimePicker && (
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={formData.time}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedTime) => {
                    if (Platform.OS === 'android') {
                      if (selectedTime) {
                        setFormData(prev => ({ ...prev, time: selectedTime }));
                        setShowTimePicker(false);
                      }
                    } else {
                      setFormData(prev => ({ ...prev, time: selectedTime || formData.time }));
                    }
                  }}
                  textColor="#FFFFFF"
                  accentColor="#8B5CF6"
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Text style={styles.confirmButtonText}>Выбрать</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text style={styles.label}>Место {formData.location === 'Онлайн' ? '(необязательно)' : '*'}</Text>
            
            {formData.location !== 'Онлайн' ? (
              <View>
                <View style={styles.locationContainer}>
                  <TextInput
                    style={styles.locationInput}
                    value={formData.location}
                    onChangeText={handleLocationChange}
                    placeholder="Например: Центральный парк"
                    placeholderTextColor="#999"
                  />
                  <View style={styles.locationButtons}>
                    <TouchableOpacity 
                      style={styles.locationButton}
                      onPress={handleLocationSelect}
                    >
                      <Text style={styles.locationButtonText}>🗺️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.locationButton, formData.location === 'Онлайн' && styles.locationButtonActive]}
                      onPress={() => {
                        setFormData(prev => ({ 
                          ...prev, 
                          location: prev.location === 'Онлайн' ? '' : 'Онлайн',
                          coordinates: prev.location === 'Онлайн' ? prev.coordinates : undefined
                        }));
                      }}
                    >
                      <Text style={styles.locationButtonText}>💻</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Выпадающий список с предложениями */}
                {showSuggestions && addressSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    {addressSuggestions.map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => handleSelectSuggestion(suggestion)}
                      >
                        <Text style={styles.suggestionName}>{suggestion.name}</Text>
                        <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.locationContainer}>
                <TextInput
                  style={styles.locationInput}
                  value="Онлайн"
                  editable={false}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity 
                  style={[styles.locationButton, styles.locationButtonActive]}
                  onPress={() => {
                    setFormData(prev => ({ 
                      ...prev, 
                      location: ''
                    }));
                  }}
                >
                  <Text style={styles.locationButtonText}>💻</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.label}>Стоимость участия</Text>
            <TextInput
              style={styles.input}
              value={formData.price}
              onChangeText={(value) => handleInputChange('price', value)}
              placeholder="Например: 500 руб или Бесплатно"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Максимум участников</Text>
            <TextInput
              style={styles.input}
              value={formData.maxParticipants}
              onChangeText={(value) => handleInputChange('maxParticipants', value)}
              placeholder="Например: 10"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Медиа</Text>
            
            <Text style={styles.label}>Фото события</Text>
            
            {formData.selectedImage ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: formData.selectedImage }} style={styles.selectedImage} />
                <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
                  <Text style={styles.removeImageText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addImageButton} onPress={showImageOptions}>
                <Text style={styles.addImageIcon}>📷</Text>
                <Text style={styles.addImageText}>Добавить фото</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.imageHint}>
              Или добавьте фото по ссылке:
            </Text>
            <TextInput
              style={styles.input}
              value={formData.mediaUrl}
              onChangeText={(value) => handleInputChange('mediaUrl', value)}
              placeholder="https://example.com/image.jpg"
              placeholderTextColor="#999"
            />

            <View style={styles.radioGroup}>
              <Text style={styles.label}>Тип медиа:</Text>
              <TouchableOpacity
                style={[styles.radioOption, formData.mediaType === 'image' && styles.radioSelected]}
                onPress={() => handleInputChange('mediaType', 'image')}
              >
                <Text style={styles.radioText}>📷 Фото</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.radioOption, formData.mediaType === 'video' && styles.radioSelected]}
                onPress={() => handleInputChange('mediaType', 'video')}
              >
                <Text style={styles.radioText}>🎥 Видео</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Предварительный просмотр</Text>
            
            <View style={styles.previewCard}>
              {/* Превью изображения */}
              {formData.selectedImage && (
                <View style={styles.previewImageContainer}>
                  <Image source={{ uri: formData.selectedImage }} style={styles.previewImage} />
                </View>
              )}
              
              <Text style={styles.previewTitle}>{formData.title}</Text>
              <Text style={styles.previewDescription}>{formData.description}</Text>
              <View style={styles.previewInfo}>
                <Text style={styles.previewInfoText}>📅 {formatDate(formData.date)} в {formatTime(formData.time)}</Text>
                <Text style={styles.previewInfoText}>📍 {formData.location}</Text>
                <Text style={styles.previewInfoText}>💰 {formData.price || 'Бесплатно'}</Text>
                <Text style={styles.previewInfoText}>👥 Макс. {formData.maxParticipants || '10'} участников</Text>
              </View>
              {formData.mediaUrl && !formData.selectedImage && (
                <Text style={styles.previewMedia}>📎 Медиа по ссылке прикреплено</Text>
              )}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>

      {/* Прогресс бар */}
      <View style={styles.progressContainer}>
        {steps.map((step) => (
          <TouchableOpacity
            key={step.number}
            style={styles.progressStep}
            onPress={() => setCurrentStep(step.number)}
          >
            <View style={[
              styles.progressCircle,
              currentStep >= step.number && styles.progressCircleActive
            ]}>
              <Text style={[
                styles.progressNumber,
                currentStep >= step.number && styles.progressNumberActive
              ]}>
                {step.number}
              </Text>
            </View>
            <Text style={[
              styles.progressTitle,
              currentStep >= step.number && styles.progressTitleActive
            ]}>
              {step.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Контент */}
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {renderStepContent()}
        
        {/* Навигация */}
        <View style={styles.navigation}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.backNavButton} onPress={handleBack}>
              <Text style={styles.backNavText}>Назад</Text>
            </TouchableOpacity>
          )}
          
          {currentStep < 3 ? (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>Далее</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>Создать событие</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    paddingTop: 60,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  progressCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressCircleActive: {
    backgroundColor: '#8B5CF6',
  },
  progressNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999999',
  },
  progressNumberActive: {
    color: '#FFFFFF',
  },
  progressTitle: {
    fontSize: 9,
    color: '#999999',
    textAlign: 'center',
  },
  progressTitleActive: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  radioGroup: {
    marginTop: 20,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#1A1A1A',
  },
  radioSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#2A1A3A',
  },
  radioText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  previewCard: {
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  previewDescription: {
    fontSize: 16,
    color: '#999999',
    marginBottom: 16,
    lineHeight: 22,
  },
  previewInfo: {
    marginBottom: 12,
  },
  previewInfoText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 6,
  },
  previewMedia: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 20,
    marginTop: 30,
  },
  backNavButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#1A1A1A',
  },
  backNavText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Стили для работы с изображениями
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addImageButton: {
    borderWidth: 2,
    borderColor: '#333333',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#1A1A1A',
  },
  addImageIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  addImageText: {
    fontSize: 16,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  imageHint: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  previewImageContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  // Стили для селекторов даты и времени
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  dateTimeButtonIcon: {
    fontSize: 20,
    marginLeft: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  locationInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#fff',
    backgroundColor: '#1a1a1a',
  },
  locationButtons: {
    flexDirection: 'row',
    marginLeft: 10,
    gap: 10,
  },
  locationButton: {
    width: 50,
    height: 50,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationButtonActive: {
    backgroundColor: '#34C759',
  },
  suggestionsContainer: {
    marginTop: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  suggestionName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  suggestionDescription: {
    color: '#999',
    fontSize: 12,
  },
  locationButtonText: {
    fontSize: 20,
  },
  autocompleteContainer: {
    flex: 1,
  },
  autocompleteInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#1A1A1A',
  },
  autocompleteList: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    maxHeight: 200,
    zIndex: 1000,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  confirmButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});