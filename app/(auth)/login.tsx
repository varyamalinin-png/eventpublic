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
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';

// Завершаем сессию OAuth для правильной работы на веб
WebBrowser.maybeCompleteAuthSession();

const logger = createLogger('Auth');

/** Вход и регистрация через Google временно скрыты.
 *  Вся логика (OAuth, loginWithGoogle) сохранена — вернуть можно флагом. */
const SHOW_GOOGLE_AUTH = false;

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; addAccount?: string }>();
  const initialMode = (params.mode === 'register' ? 'register' : 'login') as Mode;
  const isAddingAccount = params.addAccount === 'true';
  
  const {
    login,
    register,
    loginWithGoogle,
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

  const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '1095670285353-5u0ap40ms4ccqmc8hbfh32pmudi54f1v.apps.googleusercontent.com';
  const googleClientId = WEB_CLIENT_ID;

  // Для веба используем прямой подход через Google OAuth API
  // Для мобильных приложений используем expo-auth-session
  const mobileRedirectUri = AuthSession.makeRedirectUri({ scheme: 'iwent', path: 'auth', preferLocalhost: false });
  const webRedirectUri = Platform.OS === 'web' && typeof window !== 'undefined' && window.location ? `${window.location.origin}/auth` : 'https://iwent.ru/auth';

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: googleClientId,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri: Platform.OS === 'web' ? webRedirectUri : mobileRedirectUri,
    },
    { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' }
  );

  // Обработка ответа от Google OAuth (только для мобильных приложений)
  useEffect(() => {
    if (Platform.OS !== 'web' && response?.type === 'success' && response.params?.id_token) {
      handleGoogleSignIn(response.params.id_token);
    } else if (Platform.OS !== 'web' && response?.type === 'error') {
      logger.error('Google OAuth error:', response.error);
      setErrorMessage('Не удалось войти через Google');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  // Функция для прямого запуска Google OAuth на вебе
  const handleGoogleSignInWeb = () => {
    if (Platform.OS !== 'web' || !googleClientId) {
      setErrorMessage('Google OAuth не настроен');
      return;
    }

    const redirectUri = typeof window !== 'undefined' 
      ? `${window.location.origin}/auth`
      : 'https://iwent.ru/auth';
    
    // Генерируем state для защиты от CSRF
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('google_oauth_state', state);

    // Формируем URL для Google OAuth
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'id_token');
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', Math.random().toString(36).substring(2, 15));

    // Перенаправляем на Google OAuth
    if (typeof window !== 'undefined') {
      window.location.href = authUrl.toString();
    }
  };

  const handleGoogleSignIn = async (idToken: string) => {
    setErrorMessage(null);
    try {
      await loginWithGoogle(idToken);
      // После успешного логина useEffect выше обработает переход
    } catch (error: any) {
      logger.error('Google sign in failed', error);
      const errorMsg = error?.body?.message || error?.message || 'Не удалось войти через Google';
      setErrorMessage(errorMsg);
    }
  };

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
              placeholderTextColor="rgba(244,244,245,0.35)"
              keyboardType="email-address"
              autoCapitalize="none"
              value={loginEmail}
              onChangeText={setLoginEmail}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Пароль"
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
                <Text style={styles.primaryButtonText}>Войти</Text>
              )}
            </TouchableOpacity>

            {(SHOW_GOOGLE_AUTH || Platform.OS === 'ios') && (
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>или</Text>
                <View style={styles.dividerLine} />
              </View>
            )}

            {SHOW_GOOGLE_AUTH && (
              <TouchableOpacity
                style={[styles.googleButton, loading && styles.disabledButton]}
                onPress={Platform.OS === 'web' ? handleGoogleSignInWeb : () => promptAsync()}
                disabled={loading || !googleClientId}
              >
                <Text style={styles.googleButtonText}>Продолжить с Google</Text>
              </TouchableOpacity>
            )}

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.googleButton, { backgroundColor: '#000', marginTop: 10 }]}
                onPress={async () => {
                  try {
                    const credential = await AppleAuthentication.signInAsync({
                      requestedScopes: [
                        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                        AppleAuthentication.AppleAuthenticationScope.EMAIL,
                      ],
                    });
                    if (credential.identityToken) {
                      await loginWithGoogle(credential.identityToken);
                    }
                  } catch (e: any) {
                    if (e.code !== 'ERR_REQUEST_CANCELED') {
                      setErrorMessage('Не удалось войти через Apple');
                    }
                  }
                }}
              >
                <Text style={[styles.googleButtonText, { color: '#fff' }]}> Продолжить с Apple</Text>
              </TouchableOpacity>
            )}
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
              placeholder="Имя пользователя"
              placeholderTextColor="rgba(244,244,245,0.35)"
              autoCapitalize="none"
              value={registerUsername}
              onChangeText={setRegisterUsername}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Имя (необязательно)"
              placeholderTextColor="rgba(244,244,245,0.35)"
              value={registerName}
              onChangeText={setRegisterName}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Пароль"
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
                <Text style={styles.primaryButtonText}>Зарегистрироваться</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>или</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, loading && styles.disabledButton]}
              onPress={Platform.OS === 'web' ? handleGoogleSignInWeb : () => promptAsync()}
              disabled={loading || !googleClientId}
            >
              <Text style={styles.googleButtonText}>Регистрация через Google</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.googleButton, { backgroundColor: '#000', marginTop: 10 }]}
                onPress={async () => {
                  try {
                    const credential = await AppleAuthentication.signInAsync({
                      requestedScopes: [
                        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                        AppleAuthentication.AppleAuthenticationScope.EMAIL,
                      ],
                    });
                    if (credential.identityToken) {
                      await loginWithGoogle(credential.identityToken);
                    }
                  } catch (e: any) {
                    if (e.code !== 'ERR_REQUEST_CANCELED') {
                      setErrorMessage('Не удалось войти через Apple');
                    }
                  }
                }}
              >
                <Text style={[styles.googleButtonText, { color: '#fff' }]}> Регистрация через Apple</Text>
              </TouchableOpacity>
            )}
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
    color: '#0A0A0A',
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
    color: '#0A0A0A',
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1c1c20',
  },
  dividerText: {
    color: 'rgba(244,244,245,0.55)',
    fontSize: 14,
    marginHorizontal: 12,
  },
  googleButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  googleButtonText: {
    color: '#f4f4f5',
    fontSize: 16,
    fontWeight: '600',
  },
});
