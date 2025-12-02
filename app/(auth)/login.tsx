import { useState, useEffect } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { createLogger } from '../../utils/logger';

const logger = createLogger('Auth');

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; addAccount?: string }>();
  const initialMode = (params.mode === 'register' ? 'register' : 'login') as Mode;
  const isAddingAccount = params.addAccount === 'true';
  
  const {
    login,
    register,
    loading,
    isAuthenticated,
    user,
  } = useAuth();

  // После успешной авторизации переходим в приложение или настройки
  useEffect(() => {
    if (isAuthenticated && user?.emailVerified) {
      // Если это добавление аккаунта, возвращаемся на страницу настроек
      if (isAddingAccount) {
        router.replace('/settings');
      } else {
        router.replace('/(tabs)/explore');
      }
    } else if (isAuthenticated && user && !user.emailVerified) {
      // Email не подтвержден - переходим на подтверждение
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { 
          email: user.email,
          ...(isAddingAccount ? { addAccount: 'true' } : {}),
        },
      });
    }
  }, [isAuthenticated, user, router, isAddingAccount]);

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

    try {
      await login(loginEmail.trim(), loginPassword);
      // После успешного логина useEffect выше обработает переход
    } catch (error: any) {
      logger.error('login failed', error);
      const errorMsg = error?.body?.message || error?.message || 'Не удалось войти';
      
      // Если email не подтвержден, переходим на подтверждение
      if (errorMsg.toLowerCase().includes('email') && errorMsg.toLowerCase().includes('подтвержден')) {
        router.push({
          pathname: '/(auth)/verify-email',
          params: { 
            email: loginEmail.trim(),
            ...(isAddingAccount ? { addAccount: 'true' } : {}),
          },
        });
      } else {
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

    try {
      await register({
        email: registerEmail.trim(),
        username: registerUsername.trim(),
        password: registerPassword,
        name: registerName.trim() || undefined,
      });
      // После регистрации переходим на подтверждение email
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { 
          email: registerEmail.trim(),
          ...(isAddingAccount ? { addAccount: 'true' } : {}),
        },
      });
    } catch (error: any) {
      logger.error('register failed', error);
      setErrorMessage(error?.body?.message || error?.message || 'Не удалось зарегистрироваться');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Добро пожаловать</Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Войдите в свой аккаунт' : 'Создайте новый аккаунт'}
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
