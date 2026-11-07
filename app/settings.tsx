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
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '../utils/safeRouter';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEvents } from '../context/EventsContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL, apiRequest, ApiError } from '../services/api';
import { createLogger } from '../utils/logger';
import { validateUsername } from '../utils/username';
import { AppIcon, AppIconName } from '../components/ui/AppIcon';
import { Palette } from '../constants/DesignSystem';
import { settingsStyles as styles } from "../styles/settings.styles";
import { showInDevelopmentHint } from '../utils/showInDevelopmentHint';
import { SHOW_MULTI_ACCOUNT, SHOW_IN_DEVELOPMENT_ITEMS } from '../constants/featureFlags';

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

  // Модальные окна
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showDateOfBirthModal, setShowDateOfBirthModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showBioModal, setShowBioModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showComplaintsToast, setShowComplaintsToast] = useState(false);
  const complaintsToastOpacity = useRef(new Animated.Value(0)).current;

  // Страница /my-complaints временно заморожена: вместо перехода показываем
  // мигающий тост "в разработке" (переход намеренно отключён, не баг).
  const handleComplaintsPress = useCallback(() => {
    setShowComplaintsToast(true);
    Animated.sequence([
      Animated.timing(complaintsToastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(complaintsToastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setShowComplaintsToast(false));
  }, [complaintsToastOpacity]);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reminderHours, setReminderHours] = useState('24');
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [editCity, setEditCity] = useState('');
  const [editBio, setEditBio] = useState('');
  const [updating, setUpdating] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  /**
   * Заблокированные пользователи.
   *
   * Снять блокировку может только тот, кто её поставил, поэтому список —
   * это ровно «кого заблокировал я» (GET /users/me/blocked).
   */
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; name?: string; username?: string; avatarUrl?: string }>>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  const loadBlockedUsers = useCallback(async () => {
    if (!accessToken) return;
    setBlockedLoading(true);
    try {
      const response = await apiRequest('/users/me/blocked', {}, accessToken);
      setBlockedUsers(Array.isArray(response) ? response : []);
    } catch (error) {
      logger.error('Не удалось загрузить список заблокированных', error);
    } finally {
      setBlockedLoading(false);
    }
  }, [accessToken]);

  const handleUnblock = useCallback(async (blockedId: string) => {
    if (!accessToken) return;
    try {
      await apiRequest(`/users/${blockedId}/block`, { method: 'DELETE' }, accessToken);
      setBlockedUsers(prev => prev.filter(user => user.id !== blockedId));
    } catch (error) {
      logger.error('Не удалось снять блокировку', error);
      Alert.alert(t.common.error, t.profile.blockFailed);
    }
  }, [accessToken, t]);

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
      window.alert(`${t.common.error}: ${t.messages.fileReadError}`);
    } else {
      Alert.alert(t.common.error, t.messages.fileReadError);
    }
    return;
  }
  if (!accessToken || !currentUserId) {
    if (Platform.OS === 'web') {
      window.alert(`${t.common.error}: ${t.messages.reauthorize}`);
    } else {
      Alert.alert(t.common.error, t.messages.reauthorize);
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
      window.alert(`${t.common.success}: ${t.messages.profilePhotoUpdated}`);
    } else {
      Alert.alert(t.common.success, t.messages.profilePhotoUpdated);
    }
    setShowAvatarModal(false);
  } catch (error: any) {
    const errorMessage = error?.message || t.messages.photoUploadFailed;
    logger.error('Avatar upload failed:', errorMessage);
    if (Platform.OS === 'web') {
      window.alert(`Ошибка: ${errorMessage}`);
    } else {
      Alert.alert(t.common.error, errorMessage);
    }
  } finally {
    setAvatarUploading(false);
  }
};

const removeAvatarFromServer = async () => {
  if (!accessToken || !currentUserId) {
    Alert.alert(t.common.error, t.messages.reauthorize);
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
      throw new Error(data?.message || t.messages.photoDeleteFailed);
    }
    const avatarUrl: string | undefined =
      data?.avatarUrl ?? data?.user?.avatarUrl ?? data?.avatar_url ?? undefined;
    if (avatarUrl) {
      updateUserData(currentUserId, { avatar: avatarUrl });
    } else {
      updateUserData(currentUserId, { avatar: undefined });
    }
    await refreshUser();
    Alert.alert(t.common.done, t.messages.profilePhotoDeleted);
    setShowAvatarModal(false);
  } catch (error: any) {
    logger.error('Avatar delete failed', error);
    Alert.alert(t.common.error, error?.message || t.messages.photoDeleteRetry);
  } finally {
    setAvatarUploading(false);
  }
  };
  
  /**
   * Удаление аккаунта — ИЗ приложения, а не письмом в поддержку.
   *
   * Раньше кнопка открывала почтовый клиент с просьбой написать на
   * support@iwent.ru и ждать 30 дней. App Store такое отклоняет: правило
   * 5.1.1(v) требует, чтобы аккаунт удалялся внутри приложения.
   *
   * Подтверждений два: действие необратимо и уносит с собой события
   * пользователя, его публикации и переписки.
   */
  const runDeleteAccount = async () => {
    if (!currentUserId || deletingAccount) return;
    setDeletingAccount(true);
    try {
      await apiRequest('/users/me', { method: 'DELETE' }, accessToken);
      // Локальные данные аккаунта убираем только ПОСЛЕ успеха на сервере,
      // иначе при ошибке пользователь остался бы без входа с живым аккаунтом.
      await removeAccount(currentUserId);
      router.replace('/(auth)' as any);
    } catch (error: any) {
      logger.error('Account deletion failed', error);
      Alert.alert(t.common.error, error?.message || t.messages.deleteAccountFailed);
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t.messages.deleteAccountTitle,
      t.messages.deleteAccountBody,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.messages.deleteAccountAction,
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t.messages.deleteAccountConfirmTitle,
              t.messages.deleteAccountConfirmBody,
              [
                { text: t.common.cancel, style: 'cancel' },
                { text: t.messages.deleteAccountAction, style: 'destructive', onPress: runDeleteAccount },
              ]
            );
          },
        },
      ]
    );
  };
  
  
  const handleLogout = () => {
    Alert.alert(
      t.messages.logoutTitle,
      t.settings.account.logoutConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        { 
          text: t.messages.logoutAction, 
          style: 'destructive',
          onPress: async () => {
            try {
              let hasAnotherAccount = await logout();
              // Мультиаккаунт заморожен в MVP (SHOW_MULTI_ACCOUNT), но у людей,
              // которые успели завести второй аккаунт раньше, он остался в
              // хранилище. logout() в таком случае просто переключается на него
              // и возвращает true — со стороны это выглядит как «кнопка выхода
              // не работает». Пока флаг выключен, выходим до конца.
              if (!SHOW_MULTI_ACCOUNT) {
                let guard = accounts.length + 1;
                while (hasAnotherAccount && guard > 0) {
                  guard -= 1;
                  hasAnotherAccount = await logout();
                }
              }
              // Навигацией отсюда не занимаемся намеренно: RouterGate в
              // app/_layout.tsx сам уводит на /(auth)/login, как только сессия
              // очищена. Пока здесь стоял свой router.replace('/(auth)'),
              // переходов было два — сначала от RouterGate, потом отсюда, — и
              // экран входа заметно моргал дважды.
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
      Alert.alert(t.common.error, t.messages.noGalleryAccess);
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
      Alert.alert(t.common.error, t.messages.noCameraAccess);
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
      Alert.alert(t.messages.pleaseWait, t.messages.photoOpInProgress);
      return;
    }
    Alert.alert(
      t.messages.deletePhotoTitle,
      t.messages.deletePhotoConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        { 
          text: t.common.delete, 
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
      Alert.alert(t.common.done, t.messages.switchedAccount);
    } catch (error) {
      Alert.alert(t.common.error, t.messages.switchAccountFailed);
    }
  };

  const confirmRemoveAccount = (userId: string) => {
    const isSelf = userId === currentUserId;
    Alert.alert(
      isSelf ? t.messages.removeAccountTitle : t.messages.removeAccountFromList,
      isSelf
        ? t.messages.removeAccountBody
        : t.messages.removeAccountHint,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAccount(userId);
            } catch (error) {
              Alert.alert(t.common.error, t.messages.removeAccountFailed);
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
        // «YYYY-MM-DD» собираем как местную дату: new Date('1999-12-31') — это
        // полночь по UTC, и западнее Гринвича она превращалась в 30-е число.
        const dayOnly = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
        const birthDate = dayOnly
          ? new Date(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3]))
          : typeof value === 'string' ? new Date(value) : value;
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age > 0) {
            updates.age = String(age); // без суффикса — он из локали при отрисовке
          }
        }
      }
      
      updateUserData(currentUserId, updates);
      if (refreshUser) await refreshUser();
      Alert.alert(t.common.done, t.messages.changesSaved);
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : t.messages.saveChangesFailed;
      Alert.alert(t.common.error, message);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateName = async () => {
    if (!editName.trim()) {
      Alert.alert(t.common.error, t.messages.enterName);
      return;
    }
    await updateProfileField('name', editName.trim());
    setShowNameModal(false);
    setEditName('');
  };

  const handleUpdateUsername = async () => {
    const validation = validateUsername(editUsername);
    if (!validation.isValid) {
      Alert.alert(t.common.error, validation.errorMessage || t.messages.saveChangesFailed);
      return;
    }
    await updateProfileField('username', editUsername.trim());
    setShowUsernameModal(false);
    setEditUsername('');
  };

  const handleUpdateGender = async () => {
    await updateProfileField('gender', editGender);
    setShowGenderModal(false);
    setEditGender('');
  };

  const handleUpdateDateOfBirth = async () => {
    if (!editDateOfBirth) {
      Alert.alert(t.common.error, t.messages.selectBirthDate);
      return;
    }
    // Отправляем календарный день «YYYY-MM-DD» из МЕСТНЫХ компонентов даты.
    // toISOString() переводил локальную полночь в UTC и отдавал уже другой
    // день; сервер теперь сам кладёт дату на полдень по UTC.
    const y = editDateOfBirth.getFullYear();
    const m = String(editDateOfBirth.getMonth() + 1).padStart(2, '0');
    const d = String(editDateOfBirth.getDate()).padStart(2, '0');
    await updateProfileField('dateOfBirth', `${y}-${m}-${d}`);
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
      Alert.alert(t.common.error, t.messages.enterNewEmail);
      return;
    }
    if (!emailPassword) {
      Alert.alert(t.common.error, t.messages.enterCurrentPassword);
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
      Alert.alert(t.common.done, t.messages.emailChanged);
      setShowEmailModal(false);
      setNewEmail('');
      setEmailPassword('');
      if (refreshUser) await refreshUser();
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : t.messages.emailChangeFailed;
      Alert.alert(t.common.error, message);
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert(t.common.error, t.messages.fillAllFields);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t.common.error, t.validation.passwordsNotMatch);
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t.common.error, t.messages.passwordTooShort);
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
      Alert.alert(t.common.done, t.messages.passwordChanged);
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      const message = error instanceof ApiError ? error.message : t.messages.passwordChangeFailed;
      Alert.alert(t.common.error, message);
    } finally {
      setUpdating(false);
    }
  };

  const showImageOptions = () => {
    if (avatarUploading) {
      if (Platform.OS === 'web') {
        window.alert(`${t.messages.pleaseWait}. ${t.messages.finishCurrentUpload}`);
      } else {
        Alert.alert(t.messages.pleaseWait, t.messages.finishCurrentUpload);
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
            window.alert(t.messages.heicNotSupported);
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
      t.messages.choosePhoto,
      t.messages.choosePhotoSource,
      [
        { text: t.messages.gallery, onPress: () => void pickImage() },
        { text: t.messages.camera, onPress: () => void takePhoto() },
        { text: t.messages.deletePhotoTitle, onPress: handleRemoveAvatar, style: 'destructive' },
        { text: t.common.cancel, style: 'cancel' }
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
  
  /**
   * inDevelopment — переключатель, за которым пока нет логики: его значение
   * нигде не читается и никуда не сохраняется. Раньше такие тумблеры молча
   * щёлкались и создавали впечатление рабочей настройки. Теперь рядом стоит
   * подпись «В разработке», сам тумблер не переключается, а по нажатию
   * показывается пояснение — как у пункта «Изменить видимость» в карточке.
   */
  const renderSwitchItem = (
    label: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    inDevelopment = false,
  ) => (
    <TouchableOpacity
      style={styles.settingItem}
      activeOpacity={inDevelopment ? 0.6 : 1}
      disabled={!inDevelopment}
      onPress={() => showInDevelopmentHint(t.events.inDevelopment, t.events.inDevelopmentMsg)}
    >
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {inDevelopment && (
          <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(244,244,245,0.4)' }}>
            {t.events.inDevelopment}
          </Text>
        )}
        <Switch
          value={inDevelopment ? false : value}
          onValueChange={inDevelopment ? undefined : onValueChange}
          disabled={inDevelopment}
          trackColor={{ false: 'rgba(255,255,255,0.08)', true: '#FF8D32' }}
          thumbColor={value && !inDevelopment ? '#f4f4f5' : 'rgba(244,244,245,0.5)'}
        />
      </View>
    </TouchableOpacity>
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

      {showComplaintsToast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.complaintsToast, { opacity: complaintsToastOpacity }]}
        >
          <Text style={styles.complaintsToastText}>{t.profile.complaintsInDevelopment}</Text>
        </Animated.View>
      )}

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
                  <Text style={styles.accountName} numberOfLines={1} ellipsizeMode="tail">
                    {authUser?.name ?? authUser?.username ?? authUser?.email ?? t.settings.accounts.currentAccount}
                  </Text>
                  <Text style={styles.accountMeta} numberOfLines={1} ellipsizeMode="tail">
                    {authUser?.email ?? activeStoredAccount?.email ?? '—'}
                  </Text>
                  <View style={styles.accountBadge}>
                    <Text style={styles.accountBadgeText}>{t.settings.accounts.current}</Text>
                  </View>
                </View>
              </View>
            </View>

            {SHOW_MULTI_ACCOUNT && otherAccounts.length > 0 && (
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
                        <Text style={styles.accountName} numberOfLines={1} ellipsizeMode="tail">
                          {account.name || account.username || account.email || t.settings.accounts.currentAccount}
                        </Text>
                        <Text style={styles.accountMeta} numberOfLines={1} ellipsizeMode="tail">{account.email || account.username}</Text>
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
                        <Text style={styles.accountActionSecondaryText}>{t.common.delete}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Второй аккаунт заморожен до после MVP — constants/featureFlags.ts */}
            {SHOW_MULTI_ACCOUNT && (
              <>
                <TouchableOpacity style={styles.accountAddButton} onPress={() => handleAddAccount('login')}>
                  <Ionicons name="add-circle-outline" size={20} color="#FF8D32" style={{ marginRight: 8 }} />
                  <Text style={styles.accountAddButtonText}>{t.settings.accounts.addAccount}</Text>
                </TouchableOpacity>
                <Text style={styles.accountHint}>
                  {t.settings.accounts.hint}
                </Text>
              </>
            )}
          </View>
        ))}

        {/* 1. АККАУНТ И БЕЗОПАСНОСТЬ */}
        {renderSection('lock', t.settings.accountSecurity.title, (
          <>
            {renderSettingItem(t.settings.accountSecurity.email, authUser?.email ?? '—', () => setShowEmailModal(true))}
            {renderSettingItem(t.settings.accountSecurity.password, '••••••••', () => setShowPasswordModal(true))}
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
            {renderSettingItem(t.settings.profileVisibility.username, userProfile?.username ? `@${userProfile.username}` : (authUser?.username ? `@${authUser.username}` : t.settings.profileVisibility.notSpecified), () => {
              setEditUsername(userProfile?.username || authUser?.username || '');
              setShowUsernameModal(true);
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
            {SHOW_IN_DEVELOPMENT_ITEMS && renderSwitchItem(t.settings.events.autoAddAccepted, autoAddEvents, setAutoAddEvents, true)}
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
            {/* Строка «Сохранённые меморис» убрана: она вела на тот же
                экран /saved, где раздел меморис уже есть, — то есть дублировала
                строку выше и никуда больше не приводила. */}
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
            {renderSettingItem(t.profile.blockedUsers, undefined, () => {
              setShowBlockedModal(true);
              void loadBlockedUsers();
            })}
            {/* Подзаголовок без содержимого не рисуем: единственная настройка
                под ним — заглушка, скрытая до после MVP. */}
            {SHOW_IN_DEVELOPMENT_ITEMS && (
              <>
                <Text style={styles.subsectionTitle}>{t.settings.friendsCommunity.friendshipSettings}</Text>
                {renderSwitchItem(t.settings.friendsCommunity.confirmRequests, confirmFriendRequests, setConfirmFriendRequests, true)}
              </>
            )}
          </>
        ))}
        
        {/* 6. ПРИЛОЖЕНИЕ */}
        {renderSection('smartphone', t.settings.app.title, (
          <>
            {/* Версия — из самой сборки (app.json → expoConfig), а не из
                локали: там было вписано «1.0.0», и оно не менялось бы
                с обновлениями. */}
            {renderSettingItem(
              t.settings.app.about,
              Constants.expoConfig?.version
                ? t.settings.app.version.replace('{version}', Constants.expoConfig.version)
                : '',
            )}
          </>
        ))}
        
        {/* 7. ПОДДЕРЖКА */}
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
                router.push('/terms');
              } else {
                Linking.openURL('https://iwent.ru/terms');
              }
            })}
            {renderSettingItem(t.settings.support.privacy, undefined, () => {
              if (Platform.OS === 'web') {
                router.push('/privacy');
              } else {
                Linking.openURL('https://iwent.ru/privacy');
              }
            })}
            {renderSettingItem(t.settings.support.myComplaints, undefined, handleComplaintsPress)}
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
        
        {/* 8. АККАУНТ */}
        {renderSection('logout', t.settings.account.title, (
          <>
            {/* «Деактивировать аккаунт» убран: обработчик ничего не делал,
                показывал «аккаунт деактивирован» и на этом всё. Неработающая
                функция на виду — риск отказа по правилу App Store 2.1
                (полнота приложения) и просто обман пользователя. Вернём,
                когда за кнопкой появится настоящая логика. */}
            <TouchableOpacity style={styles.dangerItem} onPress={handleDeleteAccount}>
              <Text style={styles.dangerText}>{t.settings.account.delete}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerItem} onPress={handleLogout}>
              <Text style={styles.dangerText}>{t.settings.account.logout}</Text>
            </TouchableOpacity>
          </>
        ))}
      </ScrollView>
      

      {/* Заблокированные пользователи */}
      <Modal
        visible={showBlockedModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBlockedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.blockedHeader}>
              <Text style={styles.modalTitle}>{t.profile.blockedUsers}</Text>
              <TouchableOpacity onPress={() => setShowBlockedModal(false)}>
                <Ionicons name="close" size={22} color="#BBBBCC" />
              </TouchableOpacity>
            </View>

            {blockedLoading ? (
              <ActivityIndicator color="#FF8D32" style={{ marginVertical: 24 }} />
            ) : blockedUsers.length === 0 ? (
              <Text style={styles.blockedEmpty}>{t.profile.blockedUsersEmpty}</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {blockedUsers.map(user => (
                  <View key={user.id} style={styles.blockedRow}>
                    {user.avatarUrl ? (
                      <Image source={{ uri: user.avatarUrl }} style={styles.accountAvatar} />
                    ) : (
                      <View style={[styles.accountAvatar, styles.accountAvatarPlaceholder]}>
                        <Ionicons name="person-outline" size={20} color="#BBBBCC" />
                      </View>
                    )}
                    <Text style={styles.blockedName} numberOfLines={1}>
                      {user.name || user.username || user.id}
                    </Text>
                    <TouchableOpacity
                      style={styles.blockedUnblockButton}
                      onPress={() => handleUnblock(user.id)}
                    >
                      <Text style={styles.blockedUnblockText}>{t.profile.unblock}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Модальное окно изменения email */}
      <Modal
        visible={showEmailModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.settings.changeEmailTitle}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t.settings.accountSecurity.newEmail}
              placeholderTextColor="#999"
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t.settings.accountSecurity.currentPassword}
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
                <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleChangeEmail}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>{t.common.save}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      {/* Модальное окно смены пароля */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.settings.changePasswordTitle}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t.settings.accountSecurity.currentPassword}
              placeholderTextColor="#999"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t.settings.accountSecurity.newPassword}
              placeholderTextColor="#999"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t.settings.accountSecurity.confirmNewPassword}
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
                <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleChangePassword}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>{t.common.save}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модальное окно редактирования имени */}
      <Modal
        visible={showNameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNameModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.settings.changeNameTitle}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t.settings.profileVisibility.name}
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
                <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleUpdateName}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>{t.common.save}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модальное окно редактирования юзернейма */}
      <Modal
        visible={showUsernameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUsernameModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.settings.changeUsernameTitle}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t.settings.profileVisibility.username}
              placeholderTextColor="#999"
              value={editUsername}
              onChangeText={setEditUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowUsernameModal(false);
                  setEditUsername('');
                }}
              >
                <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleUpdateUsername}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>{t.common.save}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модальное окно редактирования пола */}
      <Modal
        visible={showGenderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGenderModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.settings.selectGenderTitle}</Text>
            {['male', 'female', 'other', 'prefer_not_to_say'].map((gender) => (
              <TouchableOpacity
                key={gender}
                style={[styles.genderOption, editGender === gender && styles.genderOptionSelected]}
                onPress={() => setEditGender(gender)}
              >
                <Text style={[styles.genderOptionText, editGender === gender && styles.genderOptionTextSelected]}>
                  {gender === 'male' ? t.settings.profileVisibility.male : gender === 'female' ? t.settings.profileVisibility.female : gender === 'other' ? 'Другой' : 'Не указывать'}
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
                <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleUpdateGender}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>{t.common.save}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.settings.birthDateTitle}</Text>
            
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
                style={{ backgroundColor: '#141417', width: '100%', alignSelf: 'stretch' }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.datePickerButtonText}>
                    {editDateOfBirth ? formatDateWithDots(editDateOfBirth) : t.settings.profileVisibility.selectDate}
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
                <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleUpdateDateOfBirth}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>{t.common.save}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модальное окно редактирования города */}
      <Modal
        visible={showCityModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCityModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.settings.changeCityTitle}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t.settings.profileVisibility.city}
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
                <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleUpdateCity}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>{t.common.save}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модальное окно редактирования {t.settings.aboutMeTitle} */}
      <Modal
        visible={showBioModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBioModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.settings.aboutMeTitle}</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 100, textAlignVertical: 'top' }]}
              placeholder={t.settings.profileVisibility.bio}
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
                <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, updating && styles.modalButtonDisabled]}
                onPress={handleUpdateBio}
                disabled={updating}
              >
                {updating ? <ActivityIndicator color="#f4f4f5" /> : <Text style={styles.modalButtonText}>{t.common.save}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      {/* Модальное окно настройки напоминаний */}
      <Modal
        visible={showReminderModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReminderModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.settings.remindersTitle}</Text>
            <Text style={styles.modalSubtitle}>{t.settings.remindersQuestion}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t.settings.events.hoursCount}
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
                <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={() => {
                  setShowReminderModal(false);
                  Alert.alert(t.messages.remindersConfigured);
                }}
              >
                <Text style={styles.modalButtonText}>{t.common.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модальное окно выбора языка */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
        </KeyboardAvoidingView>
      </Modal>
      
      {/* Модальное окно изменения фото профиля */}
      <Modal
        visible={showAvatarModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
                <Text style={styles.modalButtonText}>{t.common.cancel}</Text>
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
                <Text style={styles.modalButtonText}>{t.common.change}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}


