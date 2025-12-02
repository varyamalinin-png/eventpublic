import { useState, useEffect, useRef } from 'react';
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
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode = (params.mode === 'register' ? 'register' : 'login') as Mode;
  
  console.log('[AddAccount] Screen mounted, mode:', initialMode, 'params:', params);
  
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
  useEffect(() => {
    const currentUserId = user?.id || null;
    previousUserId.current = currentUserId;
    if (initialUserId.current === null) {
      initialUserId.current = currentUserId; // Сохраняем ID первого аккаунта
      console.log('[AddAccount] Initial user ID set:', currentUserId);
    }
  }, []);

  // После успешной авторизации второго аккаунта остаемся в нем и переходим в настройки
  // НО только если это новый аккаунт (userId изменился) или была попытка входа/регистрации
  useEffect(() => {
    const currentUserId = user?.id || null;
    // userId изменился только если он отличается от initialUserId (первого аккаунта)
    const userIdChanged = initialUserId.current !== null && currentUserId !== null && initialUserId.current !== currentUserId;
    
    console.log('[AddAccount] useEffect check:', {
      isAuthenticated,
      emailVerified: user?.emailVerified,
      userIdChanged,
      hasAttemptedAuth: hasAttemptedAuth.current,
      currentUserId,
      initialUserId: initialUserId.current,
    });
    
    // Перенаправляем ТОЛЬКО если:
    // 1. Пользователь авторизован И
    // 2. Email подтвержден И
    // 3. userId изменился (переключились на новый аккаунт) И
    // 4. Флаг hasAttemptedAuth установлен (была попытка входа/регистрации)
    // НЕ обрабатываем неподтвержденный email здесь - это делает handleRegister/handleLogin напрямую
    if (isAuthenticated && user?.emailVerified && userIdChanged && hasAttemptedAuth.current) {
      console.log('[AddAccount] User authenticated after login/register, redirecting to settings');
      hasAttemptedAuth.current = false; // Сбрасываем флаг после перенаправления
      router.replace('/settings');
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
      setErrorMessage('Введите email и пароль');
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
      const errorMsg = error?.body?.message || error?.message || error?.toString() || 'Не удалось войти';
      const errorMsgLower = errorMsg.toLowerCase();
      
      console.log('[AddAccount] Full error object:', {
        error,
        errorMessage: error?.message,
        errorBody: error?.body,
        errorBodyMessage: error?.body?.message,
        errorMsg,
        errorMsgLower,
      });
      
      // Проверяем, является ли ошибка связанной с неподтвержденным email
      // Сервер возвращает: "Email address is not verified. A verification email has been sent..."
      const isEmailNotVerified = 
        errorMsgLower.includes('email') && 
        (errorMsgLower.includes('not verified') || 
         errorMsgLower.includes('не подтвержден') || 
         errorMsgLower.includes('verification email') ||
         errorMsgLower.includes('verification email has been sent') ||
         errorMsgLower.includes('подтвержден'));
      
      console.log('[AddAccount] isEmailNotVerified check:', {
        isEmailNotVerified,
        hasEmail: errorMsgLower.includes('email'),
        hasNotVerified: errorMsgLower.includes('not verified'),
        hasVerificationEmail: errorMsgLower.includes('verification email'),
      });
      
      if (isEmailNotVerified) {
        console.log('[AddAccount] ✅ Email not verified, automatically redirecting to verify page');
        console.log('[AddAccount] Email:', loginEmail.trim());
        hasAttemptedAuth.current = false; // Сбрасываем флаг, так как переходим на verify
        
        // НЕМЕДЛЕННО переходим на страницу подтверждения
        // Сервер уже отправил письмо с токеном автоматически
        // Используем setTimeout, чтобы убедиться, что состояние обновилось
        setTimeout(() => {
          console.log('[AddAccount] Calling router.push to /add-account-verify');
          router.push({
            pathname: '/add-account-verify',
            params: { email: loginEmail.trim() },
          });
          console.log('[AddAccount] ✅ Navigation initiated');
        }, 100);
        return; // Выходим, не показываем ошибку
      } else {
        console.log('[AddAccount] ❌ Not an email verification error, showing error message');
        hasAttemptedAuth.current = false; // Сбрасываем флаг при ошибке
        setErrorMessage(errorMsg);
      }
    }
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    if (!registerEmail.trim() || !registerUsername.trim() || !registerPassword) {
      setErrorMessage('Заполните все обязательные поля');
      return;
    }

    if (registerPassword.length < 6) {
      setErrorMessage('Пароль должен быть не менее 6 символов');
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
      
      console.log('[AddAccount] Register result:', result);
      console.log('[AddAccount] requiresEmailVerification:', result?.requiresEmailVerification);
      console.log('[AddAccount] isAuthenticated before navigation:', isAuthenticated);
      
      // После регистрации НЕМЕДЛЕННО переходим на подтверждение email
      // Сбрасываем флаг ПЕРЕД навигацией, чтобы useEffect не перенаправлял обратно
      hasAttemptedAuth.current = false;
      
      console.log('[AddAccount] Navigating to verify page immediately, email:', registerEmail.trim());
      // Используем router.push вместо replace, чтобы можно было вернуться назад
      router.push({
        pathname: '/add-account-verify',
        params: { email: registerEmail.trim() },
      });
      console.log('[AddAccount] Navigation initiated');
    } catch (error: any) {
      logger.error('register failed', error);
      hasAttemptedAuth.current = false; // Сбрасываем флаг при ошибке
      setErrorMessage(error?.body?.message || error?.message || 'Не удалось зарегистрироваться');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Кнопка "Назад" */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
          <Text style={styles.backButtonText}>Назад</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Добавить аккаунт</Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Войдите в существующий аккаунт' : 'Создайте новый аккаунт'}
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
              placeholderTextColor="#777"
              keyboardType="email-address"
              autoCapitalize="none"
              value={loginEmail}
              onChangeText={setLoginEmail}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Пароль"
              placeholderTextColor="#777"
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
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Войти</Text>
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
              placeholderTextColor="#777"
              keyboardType="email-address"
              autoCapitalize="none"
              value={registerEmail}
              onChangeText={setRegisterEmail}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Имя пользователя"
              placeholderTextColor="#777"
              autoCapitalize="none"
              value={registerUsername}
              onChangeText={setRegisterUsername}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Имя (необязательно)"
              placeholderTextColor="#777"
              value={registerName}
              onChangeText={setRegisterName}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Пароль"
              placeholderTextColor="#777"
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
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Зарегистрироваться</Text>
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
    backgroundColor: '#0f0f0f',
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
    color: '#FFF',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#AAA',
    marginBottom: 24,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    borderRadius: 20,
    backgroundColor: '#1f1f1f',
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  tabButtonText: {
    color: '#AAA',
    fontSize: 14,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  formBlock: {
    gap: 12,
  },
  input: {
    backgroundColor: '#1f1f1f',
    color: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFF',
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

