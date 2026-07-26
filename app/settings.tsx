import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '../utils/safeRouter';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL, apiRequest, ApiError } from '../services/api';
import { createLogger } from '../utils/logger';
import { AppIcon, AppIconName } from '../components/ui/AppIcon';
import { Palette } from '../constants/DesignSystem';
import { useTheme } from '../context/ThemeContext';
import { settingsStyles as styles } from "../styles/settings.styles";

const logger = createLogger('Settings');

export default function SettingsScreen() {
  const router = useSafeRouter();
  const { getUserData, updateUserData, getSavedEvents, getSavedMemoryPosts, eventProfiles } = useEvents();
  const {
    user: authUser,
    accessToken,
    refreshUser,
    logout,
    accounts,
    activeAccountId,
    switchAccount,
    removeAccount,
    login,
    register,
    verifyEmail,
    loading,
  } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const currentUserId = authUser?.id ?? null;

  // ВСЕ ХУКИ ДОЛЖНЫ БЫТЬ ОБЪЯВЛЕНЫ ДО УСЛОВНОГО RETURN
  // Получаем данные пользователя из AuthContext для новых полей
  const [userProfile, setUserProfile] = useState<any>(null);
  
  // Загружаем профиль пользователя при монтировании
  const lastFetchedUserIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const fetchUserProfile = useCallback(() => {
    if (!currentUserId || !accessToken) return;
    
    logger.debug('Fetching user profile...', { userId: currentUserId });
    apiRequest(`/users/${currentUserId}`, {}, accessToken)
      .then((data) => {
        if (isMountedRef.current) {
          logger.debug('User profile loaded:', { 
            userId: currentUserId, 
            role: data?.role, 
            hasRole: !!data?.role,
            allKeys: Object.keys(data || {})
          });
          setUserProfile(data);
        }
      })
      .catch((error) => {
        if (!isMountedRef.current) return;
        logger.error('Error fetching user profile:', error);
        // Если пользователь не найден (404), сбрасываем профиль
        if (error?.status === 404) {
          setUserProfile(null);
          lastFetchedUserIdRef.current = null;
        }
      });
  }, [currentUserId, accessToken]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (currentUserId && accessToken && lastFetchedUserIdRef.current !== currentUserId) {
      lastFetchedUserIdRef.current = currentUserId;
      fetchUserProfile();
    }
  }, [currentUserId, accessToken, fetchUserProfile]);

  // Обновляем профиль при фокусе на экране (когда пользователь открывает настройки)
  useFocusEffect(
    useCallback(() => {
      if (currentUserId && accessToken) {
        logger.debug('Settings screen focused, refreshing user profile...');
        fetchUserProfile();
      }
    }, [currentUserId, accessToken, fetchUserProfile])
  );
  
  // Состояния для настроек
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [showAge, setShowAge] = useState(true);
  
  // Обновляем showAge при загрузке профиля
  useEffect(() => {
    if (userProfile?.showAge !== undefined) {
      setShowAge(userProfile.showAge);
    }
  }, [userProfile]);
  const [smartSuggestions, setSmartSuggestions] = useState(true);
  const [autoAddEvents, setAutoAddEvents] = useState(true);
  const [confirmFriendRequests, setConfirmFriendRequests] = useState(true);
  const { mode: theme, setMode: setTheme } = useTheme();
  
  // Модальные окна
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showDateOfBirthModal, setShowDateOfBirthModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showBioModal, setShowBioModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reminderHours, setReminderHours] = useState('24');
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editCity, setEditCity] = useState('');
  const [editBio, setEditBio] = useState('');
  const [updating, setUpdating] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // useMemo хуки также должны быть перед условным return
  const activeStoredAccount = useMemo(
    () => (currentUserId ? accounts.find(acc => acc.userId === currentUserId) ?? null : null),
    [accounts, currentUserId],
  );

  const otherAccounts = useMemo(
    () => accounts.filter(acc => acc.userId !== currentUserId),
    [accounts, currentUserId],
  );

  // УСЛОВНЫЙ RETURN ПОСЛЕ ВСЕХ ХУКОВ
  if (!currentUserId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.loginPromptTitle}>{t.settings.authorize}</Text>
        <Text style={styles.loginPromptText}>{t.settings.authorizePrompt}</Text>
        <TouchableOpacity style={styles.loginButton} onPress={() => router.push('/(auth)')}>
          <Text style={styles.loginButtonText}>{t.settings.goToLogin}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const userData = getUserData(currentUserId);
  // Для моментального UI-обновления после загрузки аватара используем локально сохранённое значение из EventsContext.
  // AuthContext может обновиться чуть позже (refreshUser), но пользователь должен видеть новую картинку сразу.
  const avatarPreviewUri =
    userData.avatar ?? authUser?.avatarUrl ?? activeStoredAccount?.avatarUrl ?? '';

const resolveAssetInfo = (asset: ImagePicker.ImagePickerAsset) => {
  const fallbackName = `avatar-${Date.now()}.jpg`;
  const rawName = asset.fileName ?? asset.uri.split('/').pop() ?? fallbackName;
  const normalizedName = rawName.includes('.') ? rawName : `${rawName}.jpg`;
  const extension = normalizedName.split('.').pop()?.toLowerCase();
  const mimeType =
    asset.mimeType ??
    (extension === 'png'
      ? 'image/png'
      : extension === 'webp'
      ? 'image/webp'
      : extension === 'heic'
      ? 'image/heic'
      : 'image/jpeg');
  return { name: normalizedName, mimeType };
};

const uploadAvatarAsset = async (asset: ImagePicker.ImagePickerAsset | { uri: string; file?: File; type?: string; name?: string }) => {
  if (!asset?.uri) {
    if (Platform.OS === 'web') {
      window.alert('Ошибка: Не удалось прочитать файл.');
    } else {
      Alert.alert('Ошибка', 'Не удалось прочитать файл.');
    }
    return;
  }
  if (!accessToken || !currentUserId) {
    if (Platform.OS === 'web') {
      window.alert('Ошибка: Авторизуйтесь заново.');
    } else {
      Alert.alert('Ошибка', 'Авторизуйтесь заново.');
    }
    return;
  }

  const formData = new FormData();
  
  if (Platform.OS === 'web' && (asset as any).file) {
    // Для веба используем File объект напрямую
    const file = (asset as any).file as File;
    formData.append('file', file);
  } else {
    // Для мобильных платформ используем старую логику
    const { name, mimeType } = resolveAssetInfo(asset as ImagePicker.ImagePickerAsset);
    formData.append('file', {
      uri: asset.uri,
      name,
      type: mimeType,
    } as any);
  }

  setAvatarUploading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });
    
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      // If response is not JSON, use status text
      throw new Error(response.statusText || `HTTP ${response.status}`);
    }
    
    if (!response.ok) {
      const errorMessage = data?.message || data?.error || `Ошибка сервера: ${response.status}`;
      throw new Error(errorMessage);
    }
    
    const avatarUrl: string | undefined =
      data?.avatarUrl ?? data?.user?.avatarUrl ?? data?.avatar_url ?? undefined;
    if (avatarUrl) {
      updateUserData(currentUserId, { avatar: avatarUrl });
    } else {
      updateUserData(currentUserId, { avatar: undefined });
    }
    await refreshUser();
    
    if (Platform.OS === 'web') {
      window.alert('Успех: Фото профиля обновлено');
    } else {
      Alert.alert('Успех', 'Фото профиля обновлено');
    }
    setShowAvatarModal(false);
  } catch (error: any) {
    const errorMessage = error?.message || 'Не удалось загрузить фото. Проверьте подключение к интернету.';
    logger.error('Avatar upload failed:', errorMessage);
    if (Platform.OS === 'web') {
      window.alert(`Ошибка: ${errorMessage}`);
    } else {
      Alert.alert('Ошибка', errorMessage);
    }
  } finally {
    setAvatarUploading(false);
  }
};

const removeAvatarFromServer = async () => {
  if (!accessToken || !currentUserId) {
    Alert.alert('Ошибка', 'Авторизуйтесь заново.');
    return;
  }
  setAvatarUploading(true);
  try {
    const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Не удалось удалить фото.');
    }
    const avatarUrl: string | undefined =
      data?.avatarUrl ?? data?.user?.avatarUrl ?? data?.avatar_url ?? undefined;
    if (avatarUrl) {
      updateUserData(currentUserId, { avatar: avatarUrl });
    } else {
      updateUserData(currentUserId, { avatar: undefined });
    }
    await refreshUser();
    Alert.alert('Готово', 'Фото профиля удалено');
    setShowAvatarModal(false);
  } catch (error: any) {
    logger.error('Avatar delete failed', error);
    Alert.alert('Ошибка', error?.message || 'Не удалось удалить фото. Попробуйте позже.');
  } finally {
    setAvatarUploading(false);
  }
  };
  
  const handleDeleteAccount = () => {
    Alert.alert(
      'Удаление аккаунта',
      'Для удаления аккаунта и всех связанных данных напишите на support@iwent.ru с указанием вашего email. Мы обработаем запрос в течение 30 дней.',
      [
        { text: 'Написать в поддержку', onPress: () => Linking.openURL('mailto:support@iwent.ru?subject=Запрос на удаление аккаунта') },
        { text: 'Отмена', style: 'cancel' },
      ]
    );
  };
  
  const handleDeactivateAccount = () => {
    Alert.alert(
      'Деактивация аккаунта',
      'Вы уверены, что хотите деактивировать аккаунт?',
      [
        { text: 'Отмена', style: 'cancel' },
        { 
          text: 'Деактивировать', 
          onPress: () => {
            // Логика деактивации
            Alert.alert('Аккаунт деактивирован');
          }
        }
      ]
    );
  };
  
  const handleLogout = () => {
    Alert.alert(
      'Выход',
      'Вы уверены, что хотите выйти?',
      [
        { text: 'Отмена', style: 'cancel' },
        { 
          text: 'Выйти', 
          style: 'destructive',
          onPress: async () => {
            try {
              const hasAnotherAccount = await logout();
              if (!hasAnotherAccount) {
                router.replace('/(auth)');
              }
            } catch (error) {
              logger.warn('Logout failed', error);
            }
          }
        }
      ]
    );
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
    if (avatarUploading) return;
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && !result.cancelled && result.assets && result.assets[0]) {
      await uploadAvatarAsset(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    if (avatarUploading) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Ошибка', 'Нет доступа к камере');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && !result.cancelled && result.assets && result.assets[0]) {
      await uploadAvatarAsset(result.assets[0]);
    }
  };

  const handleRemoveAvatar = () => {
    if (avatarUploading) {
      Alert.alert('Подождите', 'Завершается предыдущая операция с фото.');
      return;
    }
    Alert.alert(
      'Удалить фото',
      'Вы уверены, что хотите удалить фото профиля?',
      [
        { text: 'Отмена', style: 'cancel' },
        { 
          text: 'Удалить', 
          style: 'destructive',
          onPress: () => {
            void removeAvatarFromServer();
          },
        }
      ]
    );
  };

  const handleAddAccount = (mode: 'login' | 'register' = 'login') => {
    // Переходим на отдельную страницу для добавления аккаунта (доступна авторизованным пользователям)
    // Используем тот же формат, что и для /settings
    const targetPath = `/add-account?mode=${mode}`;
    router.push(targetPath);
  };


  const handleSwitchAccountPress = async (userId: string) => {
    if (userId === currentUserId) return;
    try {
      await switchAccount(userId);
      Alert.alert('Готово', 'Вы переключились на другой аккаунт.');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось переключить аккаунт. Попробуйте позже.');
    }
  };

  const confirmRemoveAccount = (userId: string) => {
    const isSelf = userId === currentUserId;
    Alert.alert(
      isSelf ? 'Удалить текущий аккаунт?' : 'Удалить аккаунт из списка?',
      isSelf
        ? 'Аккаунт будет удален с устройства. Если других аккаунтов нет, вы будете перенаправлены на экран входа.'
        : 'Этот аккаунт исчезнет из списка быстрого переключения.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAccount(userId);
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось удалить аккаунт. Попробуйте позже.');
            }
          },
        },
      ],
    );
  };

  // Функции для обновления профиля
  const updateProfileField = async (field: string, value: any) => {
    if (!currentUserId || !accessToken) return;
    setUpdating(true);
    try {
      const response = await apiRequest(
        `/users/${currentUserId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ [field]: value }),
        },
        accessToken,
      );
      setUserProfile(response);
      
      // Если обновляется dateOfBirth, вычисляем возраст и обновляем его тоже
      const updates: any = { [field]: value };
      if (field === 'dateOfBirth' && value) {
        const birthDate = typeof value === 'string' ? new Date(value) : value;
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age > 0) {
            updates.age = `${age} лет`;
          }
        }
      }
      
      updateUserData(currentUserId, updates);
      if (refreshUser) await refreshUser();
      Alert.alert('Готово', 'Изменения сохранены');
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : 'Не удалось сохранить изменения';
      Alert.alert('Ошибка', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateName = async () => {
    if (!editName.trim()) {
      Alert.alert('Ошибка', 'Введите имя');
      return;
    }
    await updateProfileField('name', editName.trim());
    setShowNameModal(false);
    setEditName('');
  };

  const handleUpdateGender = async () => {
    await updateProfileField('gender', editGender);
    setShowGenderModal(false);
    setEditGender('');
  };

  const handleUpdateDateOfBirth = async () => {
    if (!editDateOfBirth) {
      Alert.alert('Ошибка', 'Выберите дату рождения');
      return;
    }
    // Форматируем дату в ISO строку для отправки на сервер
    const isoDate = editDateOfBirth.toISOString();
    await updateProfileField('dateOfBirth', isoDate);
    setShowDateOfBirthModal(false);
    setEditDateOfBirth(null);
    setShowDatePicker(false);
  };

  const formatDateWithDots = (date: Date | null): string => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const handleUpdateCity = async () => {
    await updateProfileField('geoPosition', editCity.trim());
    setShowCityModal(false);
    setEditCity('');
  };

  const handleUpdateBio = async () => {
    await updateProfileField('bio', editBio.trim());
    setShowBioModal(false);
    setEditBio('');
  };

  const handleUpdateShowAge = async (value: boolean) => {
    setShowAge(value);
    await updateProfileField('showAge', value);
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      Alert.alert('Ошибка', 'Введите новый email');
      return;
    }
    if (!emailPassword) {
      Alert.alert('Ошибка', 'Введите текущий пароль');
      return;
    }
    setUpdating(true);
    try {
      await apiRequest(
        '/users/me/change-email',
        {
          method: 'POST',
          body: JSON.stringify({ email: newEmail.trim(), password: emailPassword }),
        },
        accessToken,
      );
      Alert.alert('Готово', 'Email изменен. Проверьте почту для подтверждения.');
      setShowEmailModal(false);
      setNewEmail('');
      setEmailPassword('');
      if (refreshUser) await refreshUser();
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : 'Не удалось изменить email';
      Alert.alert('Ошибка', message);
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен быть не менее 6 символов');
      return;
    }
    setUpdating(true);
    try {
      await apiRequest(
        '/users/me/change-password',
        {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        },
        accessToken,
      );
      Alert.alert('Готово', 'Пароль изменен');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : 'Не удалось изменить пароль';
      Alert.alert('Ошибка', message);
    } finally {
      setUpdating(false);
    }
  };

  const showImageOptions = () => {
    if (avatarUploading) {
      if (Platform.OS === 'web') {
        window.alert('Подождите, сначала завершите текущую загрузку.');
      } else {
        Alert.alert('Подождите', 'Сначала завершите текущую загрузку.');
      }
      return;
    }

    if (Platform.OS === 'web') {
      // Для веба используем input type="file"
      const input = document.createElement('input');
      input.type = 'file';
      // HEIC/HEIF часто ломают серверную оптимизацию (sharp). Разрешаем только совместимые форматы.
      input.accept = 'image/png,image/jpeg,image/webp';
      input.onchange = async (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const file = files[0];
          const type = (file.type || '').toLowerCase();
          if (type.includes('heic') || type.includes('heif')) {
            window.alert('Формат HEIC/HEIF пока не поддерживается. Выберите JPG/PNG/WebP.');
            return;
          }
          // Создаем объект, похожий на ImagePickerAsset для веба
          const asset: any = {
            uri: URL.createObjectURL(file),
            file: file, // Сохраняем File объект для загрузки
            type: file.type || 'image/jpeg',
            name: file.name || `avatar-${Date.now()}.jpg`,
          };
          await uploadAvatarAsset(asset);
        }
      };
      input.click();
      return;
    }

    Alert.alert(
      'Выберите фото',
      'Откуда хотите добавить фото?',
      [
        { text: 'Галерея', onPress: () => void pickImage() },
        { text: 'Камера', onPress: () => void takePhoto() },
        { text: 'Удалить фото', onPress: handleRemoveAvatar, style: 'destructive' },
        { text: 'Отмена', style: 'cancel' }
      ]
    );
  };
  
  const renderSection = (icon: AppIconName, title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppIcon name={icon} size={18} color={Palette.text} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
  
  const renderSettingItem = (
    label: string, 
    value?: string | React.ReactNode, 
    onPress?: () => void,
    rightComponent?: React.ReactNode
  ) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={styles.settingLabel}>{label}</Text>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      {rightComponent}
      {onPress && <Ionicons name="chevron-forward" size={20} color="#666" />}
    </TouchableOpacity>
  );
  
  const renderSwitchItem = (label: string, value: boolean, onValueChange: (value: boolean) => void) => (
    <View style={styles.settingItem}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.08)', true: '#FF8D32' }}
        thumbColor={value ? '#f4f4f5' : 'rgba(244,244,245,0.5)'}
      />
    </View>
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#f4f4f5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.settings.title}</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* БЫСТРАЯ СМЕНА АВАТАРКИ */}
        {renderSection('camera', t.settings.profileVisibility.profilePhoto, (
          <>
            {renderSettingItem(
              t.settings.profileVisibility.profilePhoto,
              t.settings.profileVisibility.uploadDelete,
              () => setShowAvatarModal(true),
              avatarPreviewUri ? (
                <Image
                  source={{ uri: avatarPreviewUri }}
                  style={styles.settingAvatarPreview}
                />
              ) : (
                <View style={[styles.settingAvatarPreview, styles.accountAvatarPlaceholder]}>
                  <Ionicons name="person-outline" size={18} color="#BBBBCC" />
                </View>
              )
            )}
          </>
        ))}

        {/* АККАУНТЫ */}
        {renderSection('users', t.settings.accounts.title, (
          <View style={styles.accountsCard}>
            <Text style={styles.subsectionTitle}>{t.settings.accounts.currentAccount}</Text>
            <View style={[styles.accountRow, styles.accountRowActive]}>
              <View style={styles.accountInfo}>
                { (userData.avatar ?? authUser?.avatarUrl ?? activeStoredAccount?.avatarUrl) ? (
                  <Image
                    source={{ uri: userData.avatar ?? authUser?.avatarUrl ?? activeStoredAccount?.avatarUrl }}
                    style={styles.accountAvatar}
                  />
                ) : (
                  <View style={[styles.accountAvatar, styles.accountAvatarPlaceholder]}>
                    <Ionicons name="person-outline" size={20} color="#BBBBCC" />
                  </View>
                )}
                <View style={styles.accountTextColumn}>
                  <Text style={styles.accountName}>
                    {authUser?.name ?? authUser?.username ?? authUser?.email ?? t.settings.accounts.currentAccount}
                  </Text>
                  <Text style={styles.accountMeta}>
                    {authUser?.email ?? activeStoredAccount?.email ?? '—'}
                  </Text>
                  <View style={styles.accountBadge}>
                    <Text style={styles.accountBadgeText}>{t.settings.accounts.current}</Text>
                  </View>
                </View>
              </View>
            </View>

            {otherAccounts.length > 0 && (
              <>
                <Text style={[styles.subsectionTitle, { marginTop: 20 }]}>{t.settings.accounts.savedAccounts}</Text>
                {otherAccounts.map(account => (
                  <View key={account.userId} style={styles.accountRow}>
                    <View style={styles.accountInfo}>
                      {account.avatarUrl ? (
                        <Image source={{ uri: account.avatarUrl }} style={styles.accountAvatar} />
                      ) : (
                        <View style={[styles.accountAvatar, styles.accountAvatarPlaceholder]}>
                          <Ionicons name="person-outline" size={20} color="#BBBBCC" />
                        </View>
                      )}
                      <View style={styles.accountTextColumn}>
                        <Text style={styles.accountName}>
                          {account.name || account.username || account.email || t.settings.accounts.currentAccount}
                        </Text>
                        <Text style={styles.accountMeta}>{account.email || account.username}</Text>
                      </View>
                    </View>
                    <View style={styles.accountActions}>
                      <TouchableOpacity
                        style={[styles.accountActionButton, styles.accountActionPrimary]}
                        onPress={() => handleSwitchAccountPress(account.userId)}
                      >
                        <Text style={styles.accountActionPrimaryText}>{t.settings.accounts.switch}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.accountActionButton, styles.accountActionSecondary]}
                        onPress={() => confirmRemoveAccount(account.userId)}
                      >
                        <Text style={styles.accountActionSecondaryText}>Удалить</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            <TouchableOpacity style={styles.accountAddButton} onPress={() => handleAddAccount('login')}>
              <Ionicons name="add-circle-outline" size={20} color="#FF8D32" style={{ marginRight: 8 }} />
              <Text style={styles.accountAddButtonText}>{t.settings.accounts.addAccount}</Text>
            </TouchableOpacity>
            <Text style={styles.accountHint}>
              {t.settings.accounts.hint}
            </Text>
          </View>
        ))}

        {/* 1. АККАУНТ И БЕЗОПАСНОСТЬ */}
        {renderSection('lock', t.settings.accountSecurity.title, (
          <>
            {renderSettingItem(t.settings.accountSecurity.email, authUser?.email ?? '—', () => setShowEmailModal(true))}
            {renderSettingItem(t.settings.accountSecurity.password, '••••••••', () => setShowPasswordModal(true))}
            {renderSwitchItem(t.settings.accountSecurity.twoFactorAuth, twoFactorAuth, setTwoFactorAuth)}
          </>
        ))}
        
        {/* 2. ПРОФИЛЬ И ВИДИМОСТЬ */}
        {renderSection('user', t.settings.profileVisibility.title, (
          <>
            <Text style={styles.subsectionTitle}>{t.settings.profileVisibility.basicInfo}</Text>
            {renderSettingItem(t.settings.profileVisibility.name, userProfile?.name || userData.name || t.settings.profileVisibility.notSpecified, () => {
              setEditName(userProfile?.name || userData.name || '');
              setShowNameModal(true);
            })}
            {renderSettingItem(t.settings.profileVisibility.gender, 
              userProfile?.gender === 'male' ? t.settings.profileVisibility.male : 
              userProfile?.gender === 'female' ? t.settings.profileVisibility.female : 
              userProfile?.gender === 'other' ? t.settings.profileVisibility.other : 
              userProfile?.gender === 'prefer_not_to_say' ? t.settings.profileVisibility.preferNotToSay : 
              t.settings.profileVisibility.notSpecified, 
              () => {
                setEditGender(userProfile?.gender || '');
                setShowGenderModal(true);
              }
            )}
            {renderSettingItem(t.settings.profileVisibility.dateOfBirth, 
              userProfile?.dateOfBirth ? formatDateWithDots(new Date(userProfile.dateOfBirth)) : t.settings.profileVisibility.notSpecified, 
              () => {
                setEditDateOfBirth(userProfile?.dateOfBirth ? new Date(userProfile.dateOfBirth) : new Date(2000, 0, 1));
                setShowDateOfBirthModal(true);
              }
            )}
            {renderSettingItem(t.settings.profileVisibility.city, userProfile?.geoPosition || userData.geoPosition || t.settings.profileVisibility.notSpecified, () => {
              setEditCity(userProfile?.geoPosition || userData.geoPosition || '');
              setShowCityModal(true);
            })}
            {renderSettingItem(t.settings.profileVisibility.bio, userProfile?.bio || userData.bio || t.settings.profileVisibility.notSpecified, () => {
              setEditBio(userProfile?.bio || userData.bio || '');
              setShowBioModal(true);
            })}
            
            <Text style={styles.subsectionTitle}>{t.settings.profileVisibility.privacy}</Text>
            {renderSwitchItem(t.settings.profileVisibility.showAge, showAge, handleUpdateShowAge)}
          </>
        ))}
        
        {/* 3. СОБЫТИЯ */}
        {renderSection('calendar', t.settings.events.title, (
          <>
            {renderSwitchItem(t.settings.events.smartSuggestions, smartSuggestions, setSmartSuggestions)}
            {renderSwitchItem(t.settings.events.autoAddAccepted, autoAddEvents, setAutoAddEvents)}
            {renderSettingItem(t.settings.events.reminders, `${reminderHours} ${t.settings.events.reminderHours}`, () => setShowReminderModal(true))}
          </>
        ))}
        
        {/* 3.5. СОХРАНЕННОЕ */}
        {renderSection('bookmark', t.settings.saved.title, (
          <>
            {renderSettingItem(
              t.settings.saved.savedEvents,
              getSavedEvents().length > 0 ? `${getSavedEvents().length} ${t.settings.saved.eventsCount}` : t.settings.saved.noSaved,
              () => router.push('/(tabs)/saved')
            )}
            {renderSettingItem(
              t.settings.saved.savedMemories || 'Сохраненные меморис',
              getSavedMemoryPosts(eventProfiles).length > 0 ? `${getSavedMemoryPosts(eventProfiles).length} ${(t.settings.saved as any).memoriesCount || 'постов'}` : t.settings.saved.noSaved,
              () => router.push('/(tabs)/saved')
            )}
          </>
        ))}
        
        {/* 4. ЯЗЫК И РЕГИОН */}
        {renderSection('globe', t.settings.languageRegion.title, (
          <>
            {renderSettingItem(
              t.settings.languageRegion.appLanguage,
              language === 'en' ? t.settings.languageRegion.english : t.settings.languageRegion.russian,
              () => setShowLanguageModal(true)
            )}
          </>
        ))}
        
        {/* 5. ДРУЗЬЯ И СООБЩЕСТВО */}
        {renderSection('users', t.settings.friendsCommunity.title, (
          <>
            {renderSettingItem(t.settings.friendsCommunity.friends, undefined, () => router.push('/friends-list'))}
            <Text style={styles.subsectionTitle}>{t.settings.friendsCommunity.friendshipSettings}</Text>
            {renderSwitchItem(t.settings.friendsCommunity.confirmRequests, confirmFriendRequests, setConfirmFriendRequests)}
          </>
        ))}
        
        {/* 6. ВНЕШНИЙ ВИД */}
        {renderSection('image', t.settings.appearance.title, (
          <>
            {renderSettingItem(t.settings.appearance.theme, theme === 'dark' ? t.settings.appearance.dark : theme === 'light' ? t.settings.appearance.light : t.settings.appearance.auto, () => {
              const themes: ('light' | 'dark' | 'auto')[] = ['light', 'dark', 'auto'];
              const currentIndex = themes.indexOf(theme);
              setTheme(themes[(currentIndex + 1) % themes.length]);
            })}
          </>
        ))}
        
        {/* 7. ПРИЛОЖЕНИЕ */}
        {renderSection('smartphone', t.settings.app.title, (
          <>
            {renderSettingItem(t.settings.app.about, t.settings.app.version)}
          </>
        ))}
        
        {/* 8. ПОДДЕРЖКА */}
        {renderSection('help', t.settings.support.title, (
          <>
            {renderSettingItem(t.settings.support.help, undefined, () => {
              Linking.openURL('mailto:support@iwent.ru');
            })}
            {renderSettingItem(t.settings.support.reportProblem, undefined, () => {
              Linking.openURL('mailto:support@iwent.ru?subject=Bug Report');
            })}
            {renderSettingItem(t.settings.support.terms, undefined, () => {
              if (Platform.OS === 'web') {
                router.push('/privacy');
              } else {
                Linking.openURL('https://iwent.ru/privacy');
              }
            })}
            {renderSettingItem(t.settings.support.privacy, undefined, () => {
              if (Platform.OS === 'web') {
                router.push('/privacy');
              } else {
                Linking.openURL('https://iwent.ru/privacy');
              }
            })}
            {renderSettingItem(t.settings.support.myComplaints, undefined, () => router.push('/my-complaints'))}
            {(() => {
              logger.debug('Checking admin panel visibility:', { 
                hasUserProfile: !!userProfile, 
                role: userProfile?.role, 
                isAdmin: userProfile?.role === 'ADMIN',
                userProfileKeys: userProfile ? Object.keys(userProfile) : []
              });
              return userProfile?.role === 'ADMIN' && (
                renderSettingItem(t.settings.support.adminPanel, t.settings.support.moderation, () => router.push('/admin/complaints'))
              );
            })()}
            {userProfile?.role === 'SUPPORT' && (
              renderSettingItem(t.settings.support.supportCabinet, t.settings.support.complaintProcessing, () => router.push('/support/complaints'))
            )}
          </>
        ))}
        
        {/* 9. АККАУНТ */}
        {renderSection('logout', t.settings.account.title, (
          <>
            {renderSettingItem(t.settings.account.deactivate, undefined, handleDeactivateAccount)}
            <TouchableOpacity style={styles.dangerItem} onPress={handleDeleteAccount}>
              <Text style={styles.dangerText}>{t.settings.account.delete}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerItem} onPress={handleLogout}>
              <Text style={styles.dangerText}>{t.settings.account.logout}</Text>
            </TouchableOpacity>
          </>
        ))}
      </ScrollView>
      

      {/* Модальное окно изменения email */}
      <Modal
        visible={showEmailModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Изменить электронную почту</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Новый email"
              placeholderTextColor="#999"
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Текущий пароль"
              placeholderTextColor="#999"
              value={emailPassword}
              onChangeText={setEmailPassword}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowEmailModal(false);
                  setNewEmail('');
                  setEmailPassword('');
                }}
              >
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleChangeEmail}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Модальное окно смены пароля */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Сменить пароль</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Текущий пароль"
              placeholderTextColor="#999"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Новый пароль"
              placeholderTextColor="#999"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Подтвердите новый пароль"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleChangePassword}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно редактирования имени */}
      <Modal
        visible={showNameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Изменить имя</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Имя и фамилия"
              placeholderTextColor="#999"
              value={editName}
              onChangeText={setEditName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowNameModal(false);
                  setEditName('');
                }}
              >
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleUpdateName}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно редактирования пола */}
      <Modal
        visible={showGenderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGenderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Выберите пол</Text>
            {['male', 'female', 'other', 'prefer_not_to_say'].map((gender) => (
              <TouchableOpacity
                key={gender}
                style={[styles.genderOption, editGender === gender && styles.genderOptionSelected]}
                onPress={() => setEditGender(gender)}
              >
                <Text style={[styles.genderOptionText, editGender === gender && styles.genderOptionTextSelected]}>
                  {gender === 'male' ? 'Мужской' : gender === 'female' ? 'Женский' : gender === 'other' ? 'Другой' : 'Не указывать'}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowGenderModal(false);
                  setEditGender('');
                }}
              >
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleUpdateGender}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно редактирования даты рождения */}
      <Modal
        visible={showDateOfBirthModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowDateOfBirthModal(false);
          setEditDateOfBirth(null);
          setShowDatePicker(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Дата рождения</Text>
            
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={editDateOfBirth ? editDateOfBirth.toISOString().split('T')[0] : ''}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    setEditDateOfBirth(new Date(e.target.value));
                  }
                }}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: '#f4f4f5',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: 10,
                  fontSize: 16,
                  width: '100%',
                }}
              />
            ) : Platform.OS === 'ios' ? (
              <DateTimePicker
                value={editDateOfBirth || new Date(2000, 0, 1)}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setEditDateOfBirth(selectedDate);
                  }
                }}
                textColor="#FFF"
                style={{ backgroundColor: '#141417' }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.datePickerButtonText}>
                    {editDateOfBirth ? formatDateWithDots(editDateOfBirth) : 'Выберите дату'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#FF8D32" />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={editDateOfBirth || new Date(2000, 0, 1)}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        setEditDateOfBirth(selectedDate);
                      }
                    }}
                  />
                )}
              </>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowDateOfBirthModal(false);
                  setEditDateOfBirth(null);
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleUpdateDateOfBirth}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно редактирования города */}
      <Modal
        visible={showCityModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Изменить город</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Город"
              placeholderTextColor="#999"
              value={editCity}
              onChangeText={setEditCity}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowCityModal(false);
                  setEditCity('');
                }}
              >
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleUpdateCity}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно редактирования "О себе" */}
      <Modal
        visible={showBioModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBioModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>О себе</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 100, textAlignVertical: 'top' }]}
              placeholder="Расскажите о себе"
              placeholderTextColor="#999"
              value={editBio}
              onChangeText={setEditBio}
              multiline={true}
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowBioModal(false);
                  setEditBio('');
                }}
              >
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleUpdateBio}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>Сохранить</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Модальное окно настройки напоминаний */}
      <Modal
        visible={showReminderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReminderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Напоминания о событиях</Text>
            <Text style={styles.modalSubtitle}>За сколько часов напоминать о событии?</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Количество часов"
              placeholderTextColor="#999"
              value={reminderHours}
              onChangeText={setReminderHours}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowReminderModal(false)}
              >
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={() => {
                  setShowReminderModal(false);
                  Alert.alert('Напоминания настроены');
                }}
              >
                <Text style={styles.modalButtonText}>Сохранить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно выбора языка */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.settings.languageRegion.appLanguage}</Text>
            {(['en', 'ru'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.genderOption, language === lang && styles.genderOptionSelected]}
                onPress={async () => {
                  await setLanguage(lang);
                  setShowLanguageModal(false);
                }}
              >
                <Text style={[styles.genderOptionText, language === lang && styles.genderOptionTextSelected]}>
                  {lang === 'en' ? t.settings.languageRegion.english : t.settings.languageRegion.russian}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowLanguageModal(false)}
              >
                <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Модальное окно изменения фото профиля */}
      <Modal
        visible={showAvatarModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.settings.profileVisibility.profilePhoto}</Text>
            
            {/* Текущее фото */}
            <View style={styles.avatarPreviewContainer}>
              <Image
                source={{ uri: userData.avatar }}
                style={[styles.avatarPreview, avatarUploading && { opacity: 0.6 }]}
              />
              {avatarUploading && (
                <ActivityIndicator style={styles.avatarUploadSpinner} color="#f4f4f5" />
              )}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowAvatarModal(false)}
                disabled={avatarUploading}
              >
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonConfirm,
                  avatarUploading && styles.modalButtonDisabled,
                ]}
                onPress={showImageOptions}
                disabled={avatarUploading}
              >
                <Text style={styles.modalButtonText}>Изменить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


