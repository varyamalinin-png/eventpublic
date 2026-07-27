import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { createLogger } from '../utils/logger';
import { Ionicons } from '@expo/vector-icons';

const logger = createLogger('AddAccount');

type Mode = 'login' | 'register';

export default function AddAccountScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode = (params.mode === 'register' ? 'register' : 'login') as Mode;
  
  
  const {
    login,
    register,
    loading,
    isAuthenticated,
    user,
  } = useAuth();

  // Флаг для отслеживания, был ли выполнен вход/регистрация на этой странице
  const hasAttemptedAuth = useRef(false);
  const previousUserId = useRef<string | null>(null);
  const initialUserId = useRef<string | null>(null); // ID пользователя при первом монтировании

  // Инициализируем previousUserId и initialUserId при монтировании
  // Важно: используем user в зависимостях, чтобы установить initialUserId когда user загрузится
  useEffect(() => {
    const currentUserId = user?.id || null;
    previousUserId.current = currentUserId;
    // Устанавливаем initialUserId только если он еще не установлен И user загружен
    if (initialUserId.current === null && currentUserId !== null) {
      initialUserId.current = currentUserId; // Сохраняем ID первого аккаунта
    }
  }, [user?.id]);

  // После успешной авторизации второго аккаунта остаемся в нем и переходим в настройки
  // НО только если это новый аккаунт (userId изменился) или была попытка входа/регистрации
  useEffect(() => {
    const currentUserId = user?.id || null;
    // userId изменился только если он отличается от initialUserId (первого аккаунта)
    const userIdChanged = initialUserId.current !== null && currentUserId !== null && initialUserId.current !== currentUserId;
    
    // Перенаправляем ТОЛЬКО если:
    // 1. Пользователь авторизован И
    // 2. Email подтвержден И
    // 3. (userId изменился ИЛИ initialUserId был null и теперь установлен) И
    // 4. Флаг hasAttemptedAuth установлен (была попытка входа/регистрации)
    // НЕ обрабатываем неподтвержденный email здесь - это делает handleRegister/handleLogin напрямую
    const shouldRedirect = isAuthenticated && 
                           user?.emailVerified && 
                           hasAttemptedAuth.current &&
                           (userIdChanged || (initialUserId.current === null && currentUserId !== null));
    
    if (shouldRedirect) {
      hasAttemptedAuth.current = false; // Сбрасываем флаг после перенаправления
      
      // На вебе используем window.location.href для надежной навигации
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/settings';
      } else {
        router.replace('/settings');
      }
    }
    
    // Обновляем previousUserId
    if (currentUserId) {
      previousUserId.current = currentUserId;
    }
  }, [isAuthenticated, user, router]);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Поля для входа
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Поля для регистрации
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerName, setRegisterName] = useState('');

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMessage(t.auth.enterEmailAndPassword);
      return;
    }

    hasAttemptedAuth.current = true; // Отмечаем, что была попытка входа
    
    try {
      await login(loginEmail.trim(), loginPassword);
      // После успешного логина useEffect выше обработает переход
      // Если email не подтвержден, login выбросит ошибку и мы обработаем ее ниже
    } catch (error: any) {
      logger.error('login failed', error);
      
      // Извлекаем сообщение об ошибке из разных возможных мест
      const errorMsg = error?.body?.message || error?.message || error?.toString() || t.auth.signInFailed;
      const errorMsgLower = errorMsg.toLowerCase();
      
      // Проверяем, является ли ошибка связанной с неподтвержденным email
      // Сервер возвращает: "Email address is not verified. A verification email has been sent..."
      const isEmailNotVerified = 
        errorMsgLower.includes('email') && 
        (errorMsgLower.includes('not verified') || 
         errorMsgLower.includes(t.auth.notVerified) || 
         errorMsgLower.includes('verification email') ||
         errorMsgLower.includes('verification email has been sent') ||
         errorMsgLower.includes(t.auth.verified));
      
      if (isEmailNotVerified) {
        hasAttemptedAuth.current = false; // Сбрасываем флаг, так как переходим на verify
        
        // НЕМЕДЛЕННО переходим на страницу подтверждения
        // Сервер уже отправил письмо с токеном автоматически
        // Используем setTimeout, чтобы убедиться, что состояние обновилось
        setTimeout(() => {
          router.push({
            pathname: '/add-account-verify',
            params: { email: loginEmail.trim() },
          });
        }, 100);
        return; // Выходим, не показываем ошибку
      } else {
        hasAttemptedAuth.current = false; // Сбрасываем флаг при ошибке
        setErrorMessage(errorMsg);
      }
    }
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    if (!registerEmail.trim() || !registerUsername.trim() || !registerPassword) {
      setErrorMessage(t.auth.fillRequiredFields);
      return;
    }

    if (registerPassword.length < 6) {
      setErrorMessage(t.messages.passwordTooShort);
      return;
    }

    hasAttemptedAuth.current = true; // Отмечаем, что была попытка регистрации

    try {
      const result = await register({
        email: registerEmail.trim(),
        username: registerUsername.trim(),
        password: registerPassword,
        name: registerName.trim() || undefined,
      });
      
      
      // После регистрации НЕМЕДЛЕННО переходим на подтверждение email
      // Сбрасываем флаг ПЕРЕД навигацией, чтобы useEffect не перенаправлял обратно
      hasAttemptedAuth.current = false;
      
      // Используем router.push вместо replace, чтобы можно было вернуться назад
      router.push({
        pathname: '/add-account-verify',
        params: { email: registerEmail.trim() },
      });
    } catch (error: any) {
      logger.error('register failed', error);
      hasAttemptedAuth.current = false; // Сбрасываем флаг при ошибке
      setErrorMessage(error?.body?.message || error?.message || t.auth.signUpFailed);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Кнопка {t.common.back} */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#f4f4f5" />
          <Text style={styles.backButtonText}>{t.common.back}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t.auth.addAccountTitle}</Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? t.auth.signInToExisting : 'Создайте новый аккаунт'}
        </Text>

        {/* Переключатель режимов */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, mode === 'login' && styles.tabButtonActive]}
            onPress={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            disabled={loading}
          >
            <Text style={[styles.tabButtonText, mode === 'login' && styles.tabButtonTextActive]}>
              Вход
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, mode === 'register' && styles.tabButtonActive]}
            onPress={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            disabled={loading}
          >
            <Text style={[styles.tabButtonText, mode === 'register' && styles.tabButtonTextActive]}>
              Регистрация
            </Text>
          </TouchableOpacity>
        </View>

        {/* Сообщение об ошибке */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Форма входа */}
        {mode === 'login' && (
          <View style={styles.formBlock}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(244,244,245,0.35)"
              keyboardType="email-address"
              autoCapitalize="none"
              value={loginEmail}
              onChangeText={setLoginEmail}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder={t.auth.password}
              placeholderTextColor="rgba(244,244,245,0.35)"
              secureTextEntry
              value={loginPassword}
              onChangeText={setLoginPassword}
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#f4f4f5" />
              ) : (
                <Text style={styles.primaryButtonText}>{t.auth.signInAction}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Форма регистрации */}
        {mode === 'register' && (
          <View style={styles.formBlock}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(244,244,245,0.35)"
              keyboardType="email-address"
              autoCapitalize="none"
              value={registerEmail}
              onChangeText={setRegisterEmail}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder={t.auth.username}
              placeholderTextColor="rgba(244,244,245,0.35)"
              autoCapitalize="none"
              value={registerUsername}
              onChangeText={setRegisterUsername}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder={t.auth.nameOptional}
              placeholderTextColor="rgba(244,244,245,0.35)"
              value={registerName}
              onChangeText={setRegisterName}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder={t.auth.password}
              placeholderTextColor="rgba(244,244,245,0.35)"
              secureTextEntry
              value={registerPassword}
              onChangeText={setRegisterPassword}
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#f4f4f5" />
              ) : (
                <Text style={styles.primaryButtonText}>{t.auth.signUpAction}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#0a0a0c',
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(244,244,245,0.55)',
    marginBottom: 24,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    borderRadius: 20,
    backgroundColor: '#141417',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FF8D32',
  },
  tabButtonText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#f4f4f5',
    fontWeight: '600',
  },
  formBlock: {
    gap: 12,
  },
  input: {
    backgroundColor: '#141417',
    color: '#f4f4f5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  primaryButton: {
    backgroundColor: '#FF8D32',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorBox: {
    backgroundColor: '#3a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
  },
});

